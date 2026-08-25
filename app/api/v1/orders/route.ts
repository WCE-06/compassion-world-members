import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";
import { getOrderProducts } from "@/lib/order-catalog";
import { pointRuleFor } from "@/lib/point-policy";
import { expireStaleLocks,expireStaleOrder } from "@/lib/order-pos";
import { estimateOrderSchedule,getOrderSchedule,scheduleReadyAt } from "@/lib/kitchen-schedule";

type Department="FOOD"|"DRINK";
const departmentLabel:Record<Department,string>={FOOD:"フード",DRINK:"ドリンク"};
function normalizedTaxDivision(value:string){return value==="1"?"EXCLUDED":value==="2"?"NON_TAXABLE":"INCLUDED"}
function normalizedTaxRounding(value:string){return value==="0"?"ROUND":value==="2"?"CEIL":"FLOOR"}
function excludingTax(product:{price:number;basePrice:number;taxRate:number;taxDivision:string}){if(product.taxDivision==="1"||product.taxDivision==="2")return product.basePrice;return Math.ceil(product.price*100/(100+(product.taxRate||10)))}

function businessDate(now:number){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
}

async function allocateCallNumber(callDate:string,department:Department,now:number){
  const row=await env.DB.prepare(`INSERT INTO order_call_counters (call_date,department,last_number,updated_at) VALUES (?,?,1,?) ON CONFLICT(call_date,department) DO UPDATE SET last_number=CASE WHEN last_number>=999 THEN 1 ELSE last_number+1 END,updated_at=excluded.updated_at RETURNING last_number AS callNumber`).bind(callDate,department,now).first<{callNumber:number}>();
  if(!row)throw new Error("CALL_NUMBER_ALLOCATION_FAILED");
  return row.callNumber;
}

export async function GET(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  await expireStaleLocks();await expireStaleOrder();
  const orderId=request.nextUrl.searchParams.get("orderId")?.trim();
  if(orderId){
    const order=await env.DB.prepare(`SELECT id AS orderId,order_number AS orderNumber,status,payment_method AS paymentMethod,total_including_tax AS totalIncludingTax,point_eligible AS pointEligible,point_status AS pointStatus,expires_at AS expiresAt FROM orders WHERE id=? AND member_id=?`).bind(orderId,member.id).first<{orderId:string;orderNumber:string;status:string;paymentMethod:"STORE"|"STRIPE";totalIncludingTax:number;pointEligible:number;pointStatus:string;expiresAt:number}>();
    if(!order)return NextResponse.json({error:"ORDER_NOT_FOUND"},{status:404});
    const fulfillments=await env.DB.prepare(`SELECT department,call_number AS callNumber,status FROM order_fulfillments WHERE order_id=? ORDER BY department`).bind(orderId).all<{department:Department;callNumber:number;status:string}>();
    const schedule=await getOrderSchedule(orderId);
    return NextResponse.json({...order,pointEligible:Boolean(order.pointEligible),paymentLabel:order.paymentMethod==="STRIPE"?"スマート決済":"現地決済",fulfillments:fulfillments.results.map(item=>({...item,label:departmentLabel[item.department]})),schedule,scheduleLabel:schedule?null:"提供予定時間を確認しています。しばらくお待ちください。"},{headers:{"Cache-Control":"no-store"}});
  }
  const result = await env.DB.prepare(
    `SELECT id, order_number AS orderNumber, status, payment_method AS paymentMethod, total_including_tax AS totalIncludingTax,
     point_eligible AS pointEligible, point_status AS pointStatus, points_earned AS pointsEarned,
     pickup_at AS pickupAt, expires_at AS expiresAt, created_at AS createdAt FROM orders WHERE member_id = ? ORDER BY created_at DESC LIMIT 20`,
  ).bind(member.id).all();
  return NextResponse.json({ orders: result.results });
}

export async function POST(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { items?: { productId?: string; quantity?: number }[]; pickupAt?: number; requestId?: string; paymentMethod?: "STORE"|"STRIPE" } | null;
  const requested = body?.items ?? [];
  const {products}=await getOrderProducts({timeoutMs:3_000,allowSnapshotFallback:true});
  const items = requested.map(item => {
    const product = products.find(candidate => candidate.id === item.productId&&!candidate.soldOut);
    const quantity = Number(item.quantity);
    return product && Number.isInteger(quantity) && quantity > 0 && quantity <= 20 ? { product, quantity } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!items.length || items.length !== requested.length) return NextResponse.json({ error: "INVALID_ORDER_ITEMS" }, { status: 400 });
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const paymentMethod = body?.paymentMethod === "STRIPE" ? "STRIPE" : "STORE";
  const runtime = env as unknown as Record<string,string|undefined>;
  if (paymentMethod === "STRIPE" && runtime.SMART_PAYMENT_ENABLED !== "true") return NextResponse.json({ error:"SMART_PAYMENT_NOT_READY", message:"スマート決済は現在準備中です" }, { status:503 });
  const pointRule = pointRuleFor("MOBILE_ORDER");
  const requestId = body?.requestId?.match(/^[a-zA-Z0-9-]{10,80}$/) ? body.requestId : crypto.randomUUID();
  const id = `ord_${requestId}`;
  const existing = await env.DB.prepare(`SELECT order_number AS orderNumber, status, payment_method AS paymentMethod, total_including_tax AS totalIncludingTax FROM orders WHERE id = ? AND member_id = ?`).bind(id, member.id).first();
  if (existing) {const [result,schedule]=await Promise.all([env.DB.prepare(`SELECT department,call_number AS callNumber,status FROM order_fulfillments WHERE order_id=? ORDER BY department`).bind(id).all(),getOrderSchedule(id)]);return NextResponse.json({ orderId:id,...existing,fulfillments:result.results,schedule,scheduleLabel:schedule?null:"提供予定時間を確認しています。しばらくお待ちください。" });}
  const now = Date.now(); const orderNumber = `ORD-${String(now).slice(-8)}`; const expiresAt = now + 15 * 60_000;const callDate=businessDate(now);
  const departments=[...new Set(items.map(item=>item.product.category))] as Department[];
  const fulfillments=await Promise.all(departments.map(async department=>({department,callNumber:await allocateCallNumber(callDate,department,now),status:"WAITING_PAYMENT" as const,label:departmentLabel[department]})));
  const scheduleItems=items.map(item=>({productId:item.product.id,productCode:item.product.code,name:item.product.name,quantity:item.quantity,department:item.product.category,preparationMinutes:item.product.preparationMinutes,options:[]}));
  const schedule=await estimateOrderSchedule(requestId,scheduleItems).catch(()=>null);const pickupAt=scheduleReadyAt(schedule);
  const statements=[env.DB.prepare(
    `INSERT INTO orders (id, order_number, member_id, status, payment_method, total_including_tax, point_eligible, point_status, pickup_at, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
  ).bind(id, orderNumber, member.id, paymentMethod === "STRIPE" ? "PENDING_PAYMENT" : "WAITING_STORE_PAYMENT", paymentMethod, total, pointRule.eligible ? 1 : 0, pickupAt, expiresAt, now, now),
  ...items.map(item=>env.DB.prepare(`INSERT INTO order_items (id,order_id,product_id,product_code,product_name,department,quantity,unit_price_excluding_tax,unit_price_including_tax,tax_rate,tax_division,tax_rounding,preparation_minutes,selected_options_json,line_total_including_tax) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,item.product.id,item.product.code,item.product.name,item.product.category,item.quantity,excludingTax(item.product),item.product.price,item.product.taxRate||10,normalizedTaxDivision(item.product.taxDivision),normalizedTaxRounding(item.product.taxRounding),item.product.preparationMinutes,"[]",item.product.price*item.quantity)),
  ...fulfillments.map(item=>env.DB.prepare(`INSERT INTO order_fulfillments (id,order_id,department,call_date,call_number,status,updated_at) VALUES (?,?,?,?,?,'WAITING_PAYMENT',?)`).bind(crypto.randomUUID(),id,item.department,callDate,item.callNumber,now))];
  await env.DB.batch(statements);
  return NextResponse.json({ orderId: id, orderNumber, fulfillments, status: paymentMethod === "STRIPE" ? "PENDING_PAYMENT" : "WAITING_STORE_PAYMENT", paymentMethod, paymentLabel:paymentMethod === "STRIPE" ? "スマート決済" : "現地決済", pointEligible:pointRule.eligible, pointStatus:"PENDING", totalIncludingTax: total, expiresAt, schedule, scheduleLabel:schedule?null:"提供予定時間を確認しています。しばらくお待ちください。" }, { status: 201 });
}
