import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireKitchenToken } from "@/lib/kitchen-api";
import { getOrderProducts, resolveOrderProducts, type OrderProduct } from "@/lib/order-catalog";
import { allocateKitchenUnitNumber, kitchenBusinessDate } from "@/lib/kitchen-units";
import { confirmOrderSchedule } from "@/lib/kitchen-schedule";

type Department = "FOOD" | "DRINK";
type Detail = { transactionDetailId?: string; transactionDetailDivision?: string; productId?: string; productCode?: string; productName?: string; salesPrice?: string; quantity?: string; memo?: string };
type Transaction = { transactionHeadId?: string; transactionDateTime?: string; updDateTime?: string; transactionHeadDivision?: string; cancelDivision?: string; terminalId?: string; total?: string; details?: Detail[] };
type MatchedLine = { detail: Detail; product: OrderProduct; quantity: number; itemId: string };

const GUEST_MEMBER_ID = "system:paygate-pos";
const GUEST_MEMBER_CODE = "PAYGATE-POS";

function validTransactionId(value: string) { return /^[A-Za-z0-9_-]{1,40}$/.test(value); }
function integerQuantity(value: unknown) { const quantity = Number(value); return Number.isInteger(quantity) && quantity > 0 && quantity <= 20 ? quantity : 0; }
function safeIdPart(value: string) { return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48); }
function excludingTax(product: OrderProduct) { if (product.taxDivision === "1" || product.taxDivision === "2") return product.basePrice; return Math.ceil(product.price * 100 / (100 + (product.taxRate || 10))); }
function taxDivision(value: string) { return value === "1" ? "EXCLUDED" : value === "2" ? "NON_TAXABLE" : "INCLUDED"; }
function taxRounding(value: string) { return value === "0" ? "ROUND" : value === "2" ? "CEIL" : "FLOOR"; }

async function cancelImportedOrder(transactionId: string, now: number) {
  const existing = await env.DB.prepare("SELECT id,status FROM orders WHERE smaregi_transaction_id=?").bind(transactionId).first<{id:string;status:string}>();
  if (!existing) return null;
  await env.DB.batch([
    env.DB.prepare("UPDATE kitchen_units SET status='CANCELLED',updated_at=? WHERE order_id=? AND status NOT IN ('PICKED_UP','CANCELLED')").bind(now, existing.id),
    env.DB.prepare("UPDATE order_fulfillments SET status='CANCELLED',updated_at=? WHERE order_id=? AND status NOT IN ('PICKED_UP','CANCELLED')").bind(now, existing.id),
    env.DB.prepare("UPDATE orders SET status='CANCELLED',updated_at=? WHERE id=? AND status NOT IN ('PICKED_UP','CANCELLED')").bind(now, existing.id),
  ]);
  return existing.id;
}

async function matchLines(details: Detail[]) {
  const { products } = await getOrderProducts({ includeOverrides: true, includeClosedProducts: true, timeoutMs: 4_000, allowSnapshotFallback: true });
  const normal = details.filter(detail => (detail.transactionDetailDivision ?? "1") === "1" && detail.productCode && integerQuantity(detail.quantity));
  const resolved = await resolveOrderProducts(products, normal.map(detail => ({ productId: detail.productCode, quantity: integerQuantity(detail.quantity) })));
  return normal.flatMap((detail, index): MatchedLine[] => {
    const match = resolved[index];
    if (!match) return [];
    const detailId = safeIdPart(detail.transactionDetailId || String(index + 1));
    return [{ detail, product: match.product, quantity: match.quantity, itemId: detailId }];
  });
}

export async function POST(request: NextRequest) {
  if (!await requireKitchenToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const transaction = await request.json().catch(() => null) as Transaction | null;
  const transactionId = String(transaction?.transactionHeadId ?? "");
  if (!validTransactionId(transactionId) || transaction?.transactionHeadDivision !== "1") return NextResponse.json({ error: "INVALID_POS_TRANSACTION" }, { status: 400 });
  const now = Date.now();
  if (transaction.cancelDivision === "1") {
    const orderId = await cancelImportedOrder(transactionId, now);
    return NextResponse.json({ ok: true, imported: false, cancelled: Boolean(orderId), orderId });
  }
  const lines = await matchLines(transaction.details ?? []);
  if (!lines.length) return NextResponse.json({ ok: true, imported: false, ignored: "NO_KITCHEN_ITEMS" });

  const orderId = `ord_pos_${safeIdPart(transactionId)}`, orderNumber = `POS-${transactionId}`, callDate = kitchenBusinessDate(Date.parse(transaction.transactionDateTime ?? "") || now);
  const existing = await env.DB.prepare("SELECT id FROM orders WHERE smaregi_transaction_id=? OR id=?").bind(transactionId, orderId).first<{id:string}>();
  if (existing) return NextResponse.json({ ok: true, imported: false, idempotentReplay: true, orderId: existing.id });

  await env.DB.prepare("INSERT OR IGNORE INTO members(id,member_code,display_name,points_balance,member_rank,resident_status,status,verification_status,source_system,created_at,updated_at) VALUES(?,?,?,0,'STANDARD','UNKNOWN','ACTIVE','ACTIVE','PAYGATE_POS',?,?)")
    .bind(GUEST_MEMBER_ID, GUEST_MEMBER_CODE, "PAYGATE POS 店頭注文", now, now).run();

  const unitRows: { id:string; itemId:string; department:Department; callNumber:number; unitIndex:number }[] = [];
  for (const line of lines) for (let unitIndex = 1; unitIndex <= line.quantity; unitIndex += 1) unitRows.push({
    id: `ku_pos_${safeIdPart(transactionId)}_${line.itemId}_${unitIndex}`,
    itemId: `item_pos_${safeIdPart(transactionId)}_${line.itemId}`,
    department: line.product.category,
    callNumber: await allocateKitchenUnitNumber(line.product.category, callDate, now),
    unitIndex,
  });
  const departments = [...new Set(unitRows.map(unit => unit.department))];
  const total = lines.reduce((sum, line) => sum + Math.max(0, Math.round(Number(line.detail.salesPrice ?? line.product.price))) * line.quantity, 0);
  const createdAt = Date.parse(transaction.transactionDateTime ?? "") || now;
  const statements = [
    env.DB.prepare("INSERT OR IGNORE INTO orders(id,order_number,member_id,status,payment_method,total_including_tax,point_eligible,point_status,points_earned,smaregi_transaction_id,created_at,updated_at) VALUES(?,?,?,'PAID','STORE',?,0,'PENDING',0,?,?,?)").bind(orderId, orderNumber, GUEST_MEMBER_ID, total, transactionId, createdAt, now),
    ...lines.map(line => {
      const itemId = `item_pos_${safeIdPart(transactionId)}_${line.itemId}`, unitPrice = Math.max(0, Math.round(Number(line.detail.salesPrice ?? line.product.price)));
      const options = line.detail.memo?.trim() ? JSON.stringify([line.detail.memo.trim()]) : "[]";
      return env.DB.prepare("INSERT OR IGNORE INTO order_items(id,order_id,product_id,product_code,product_name,department,quantity,unit_price_excluding_tax,unit_price_including_tax,tax_rate,tax_division,tax_rounding,preparation_minutes,selected_options_json,line_total_including_tax) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(itemId, orderId, line.product.id, line.product.code, String(line.detail.productName || line.product.name).slice(0, 85), line.product.category, line.quantity, excludingTax(line.product), unitPrice, line.product.taxRate || 10, taxDivision(line.product.taxDivision), taxRounding(line.product.taxRounding), line.product.preparationMinutes, options, unitPrice * line.quantity);
    }),
    ...departments.map(department => { const first = unitRows.find(unit => unit.department === department)!; return env.DB.prepare("INSERT OR IGNORE INTO order_fulfillments(id,order_id,department,call_date,call_number,status,updated_at) VALUES(?,?,?,?,?,'ACCEPTED',?)").bind(`ful_pos_${safeIdPart(transactionId)}_${department}`, orderId, department, `LEGACY:${callDate}`, first.callNumber, now); }),
    ...unitRows.map(unit => env.DB.prepare("INSERT OR IGNORE INTO kitchen_units(id,order_id,order_item_id,unit_index,department,call_date,call_number,status,current_step,total_steps,is_test,updated_at) VALUES(?,?,?,?,?,?,?,'ACCEPTED',0,1,0,?)").bind(unit.id, orderId, unit.itemId, unit.unitIndex, unit.department, callDate, unit.callNumber, now)),
  ];
  await env.DB.batch(statements);
  await confirmOrderSchedule(orderId, "PAYGATE_POS_TRANSACTION_IMPORTED").catch(() => undefined);
  return NextResponse.json({ ok: true, imported: true, orderId, orderNumber, units: unitRows.length }, { status: 201 });
}
