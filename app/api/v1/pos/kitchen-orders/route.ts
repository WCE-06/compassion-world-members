import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { getOrderProducts, resolveOrderProducts } from "@/lib/order-catalog";
import { requirePosToken } from "@/lib/pos-api";
import { authorizedVerificationSystem } from "@/lib/member-verification";
import { ensureOrderAcceptedNotice } from "@/lib/order-notifications";
import { confirmOrderSchedule } from "@/lib/kitchen-schedule";
import {
  allocateKitchenUnitNumber,
  kitchenBusinessDate,
  orderUnits,
} from "@/lib/kitchen-units";

type Department = "FOOD" | "DRINK";
type SelectedOption = {
  optionGroupId?: string;
  optionId?: string;
  groupName?: string;
  optionName?: string;
  productCode?: string;
};
type Body = {
  requestId?: string;
  paymentId?: string;
  memberCode?: string;
  deviceId?: string;
  items?: Array<{
    productCode?: string;
    quantity?: number;
    selectedOptions?: SelectedOption[];
  }>;
};

function taxDivision(value: string) {
  return value === "1" ? "EXCLUDED" : value === "2" ? "NON_TAXABLE" : "INCLUDED";
}
function taxRounding(value: string) {
  return value === "0" ? "ROUND" : value === "2" ? "CEIL" : "FLOOR";
}
function excludingTax(product: { price: number; basePrice: number; taxRate: number; taxDivision: string }) {
  if (product.taxDivision === "1" || product.taxDivision === "2") return product.basePrice;
  return Math.ceil(product.price * 100 / (100 + (product.taxRate || 10)));
}

async function responseFor(orderId: string, paymentId: string, idempotentReplay: boolean) {
  await ensureOrderAcceptedNotice(orderId);
  const units = await orderUnits(orderId);
  const schedule = await confirmOrderSchedule(
    orderId,
    idempotentReplay ? "店頭注文通知の再同期" : "セルフレジ店頭注文の受付",
  ).catch(() => null);
  return NextResponse.json({
    ok: true,
    orderId,
    paymentId,
    orderStatus: "PAID",
    kitchenStatus: units.every((unit) => unit.status === "ACCEPTED") ? "ACCEPTED" : "PARTIAL",
    idempotentReplay,
    units,
    schedule,
  });
}

/** セルフレジで新しく選んだ料理を、決済成立後にキッチンへ一度だけ登録する。 */
export async function POST(request: NextRequest) {
  // The Android register uses its dedicated member-verification credential for
  // direct order lookups and locks. Accept that same SELF_REGISTER-scoped
  // credential here; credentials for the other facility systems remain invalid.
  if (!await requirePosToken(request) && !await authorizedVerificationSystem(request, "SELF_REGISTER")) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as Body | null;
  const requestId = body?.requestId?.trim() ?? "";
  const paymentId = body?.paymentId?.trim() ?? "";
  const memberCode = body?.memberCode?.trim().toUpperCase() ?? "";
  const deviceId = body?.deviceId?.trim() ?? "SELF-REGISTER-01";
  const requested = body?.items ?? [];
  if (!/^[A-Za-z0-9-]{10,100}$/.test(requestId) || !paymentId || paymentId.length > 120 ||
      !/^[A-Z0-9]{10}$/.test(memberCode) || !requested.length || requested.length > 100) {
    return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const orderId = `ord_pos_${requestId}`;
  const existing = await env.DB.prepare(
    "SELECT status,smaregi_transaction_id AS paymentId FROM orders WHERE id=?",
  ).bind(orderId).first<{ status: string; paymentId: string | null }>();
  if (existing) {
    if (existing.paymentId !== paymentId) {
      return NextResponse.json({ ok: false, error: "ORDER_REQUEST_CONFLICT" }, { status: 409 });
    }
    return responseFor(orderId, paymentId, true);
  }
  const duplicate = await env.DB.prepare(
    "SELECT id FROM orders WHERE smaregi_transaction_id=?",
  ).bind(paymentId).first();
  if (duplicate) {
    return NextResponse.json({ ok: false, error: "DUPLICATE_PAYMENT_ID" }, { status: 409 });
  }
  const member = await env.DB.prepare(
    "SELECT id FROM members WHERE member_code=? AND status='ACTIVE' LIMIT 1",
  ).bind(memberCode).first<{ id: string }>();
  if (!member) return NextResponse.json({ ok: false, error: "MEMBER_NOT_FOUND" }, { status: 404 });

  const { products } = await getOrderProducts({
    channel: "SELF_REGISTER",
    timeoutMs: 3_000,
    allowSnapshotFallback: true,
    includeClosedProducts: true,
  });
  const resolved = await resolveOrderProducts(products, requested.map((item) => ({
    productId: item.productCode,
    quantity: item.quantity,
  })));
  if (resolved.some((item) => !item)) {
    return NextResponse.json({ ok: false, error: "PRODUCT_UNAVAILABLE" }, { status: 409 });
  }
  const items = resolved.map((entry, index) => ({
    product: entry!.product,
    quantity: entry!.quantity,
    options: (requested[index].selectedOptions ?? []).map((option) => ({
      optionGroupId: String(option.optionGroupId ?? "").slice(0, 80),
      optionId: String(option.optionId ?? "").slice(0, 80),
      groupName: String(option.groupName ?? "").slice(0, 120),
      optionName: String(option.optionName ?? "").slice(0, 120),
      productCode: String(option.productCode ?? "").slice(0, 80),
    })),
  }));
  if (items.some((item) => item.product.soldOut)) {
    return NextResponse.json({ ok: false, error: "PRODUCT_SOLD_OUT" }, { status: 409 });
  }

  const now = Date.now();
  const orderNumber = `ORD-${String(now).slice(-8)}`;
  const callDate = kitchenBusinessDate(now);
  const itemRows = items.map((item) => ({ id: `item_${crypto.randomUUID()}`, ...item }));
  const unitRows: Array<{
    id: string; orderItemId: string; department: Department; callNumber: number; unitIndex: number;
  }> = [];
  for (const item of itemRows) {
    for (let unitIndex = 1; unitIndex <= item.quantity; unitIndex += 1) {
      unitRows.push({
        id: `ku_${crypto.randomUUID()}`,
        orderItemId: item.id,
        department: item.product.category,
        callNumber: await allocateKitchenUnitNumber(item.product.category, callDate, now),
        unitIndex,
      });
    }
  }
  const departments = [...new Set(unitRows.map((unit) => unit.department))];
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const statements = [
    env.DB.prepare(
      `INSERT INTO orders (id,order_number,member_id,status,payment_method,total_including_tax,point_eligible,point_status,smaregi_transaction_id,expires_at,created_at,updated_at)
       VALUES (?,?,?,'PAID','STORE',?,1,'PENDING',?,?,?,?)`,
    ).bind(orderId, orderNumber, member.id, total, paymentId, now, now, now),
    ...itemRows.map((item) => env.DB.prepare(
      `INSERT INTO order_items (id,order_id,product_id,product_code,product_name,department,quantity,unit_price_excluding_tax,unit_price_including_tax,tax_rate,tax_division,tax_rounding,preparation_minutes,selected_options_json,line_total_including_tax)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      item.id, orderId, item.product.id, item.product.code, item.product.name, item.product.category,
      item.quantity, excludingTax(item.product), item.product.price, item.product.taxRate || 10,
      taxDivision(item.product.taxDivision), taxRounding(item.product.taxRounding),
      item.product.preparationMinutes, JSON.stringify(item.options), item.product.price * item.quantity,
    )),
    ...departments.map((department) => {
      const first = unitRows.find((unit) => unit.department === department)!;
      return env.DB.prepare(
        `INSERT INTO order_fulfillments (id,order_id,department,call_date,call_number,status,updated_at)
         VALUES (?,?,?,?,?,'ACCEPTED',?)`,
      ).bind(crypto.randomUUID(), orderId, department, `LEGACY:${callDate}`, first.callNumber, now);
    }),
    ...unitRows.map((unit) => env.DB.prepare(
      `INSERT INTO kitchen_units (id,order_id,order_item_id,unit_index,department,call_date,call_number,status,current_step,total_steps,is_test,updated_at)
       VALUES (?,?,?,?,?,?,?,'ACCEPTED',0,1,0,?)`,
    ).bind(unit.id, orderId, unit.orderItemId, unit.unitIndex, unit.department, callDate, unit.callNumber, now)),
  ];
  await env.DB.batch(statements);
  await env.DB.prepare(
    `INSERT INTO order_payment_events (id,request_id,order_id,payment_id,device_id,paid_at,created_at)
     VALUES (?,?,?,?,?,?,?)`,
  ).bind(crypto.randomUUID(), requestId, orderId, paymentId, deviceId, now, now).run();
  return responseFor(orderId, paymentId, false);
}
