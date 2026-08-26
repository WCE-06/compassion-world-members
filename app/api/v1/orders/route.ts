import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedLiveMember } from "@/lib/member-auth";
import { getOrderProducts,resolveOrderProducts } from "@/lib/order-catalog";
import { pointRuleFor } from "@/lib/point-policy";
import { expireStaleLocks,expireStaleOrder } from "@/lib/order-pos";
import { estimateOrderSchedule,getOrderSchedule,scheduleReadyAt } from "@/lib/kitchen-schedule";
import { allocateKitchenUnitNumber,kitchenBusinessDate,orderUnits } from "@/lib/kitchen-units";

type Department="FOOD"|"DRINK";
const departmentLabel:Record<Department,string>={FOOD:"フード",DRINK:"ドリンク"};
function normalizedTaxDivision(value:string){return value==="1"?"EXCLUDED":value==="2"?"NON_TAXABLE":"INCLUDED"}
function normalizedTaxRounding(value:string){return value==="0"?"ROUND":value==="2"?"CEIL":"FLOOR"}
function excludingTax(product:{price:number;basePrice:number;taxRate:number;taxDivision:string}){if(product.taxDivision==="1"||product.taxDivision==="2")return product.basePrice;return Math.ceil(product.price*100/(100+(product.taxRate||10)))}

export async function GET(request: NextRequest) {
  const member = await authenticatedLiveMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  await expireStaleLocks();await expireStaleOrder();
  const orderId=request.nextUrl.searchParams.get("orderId")?.trim();
  if(orderId){
    const order=await env.DB.prepare(`SELECT id AS orderId,order_number AS orderNumber,status,payment_method AS paymentMethod,total_including_tax AS totalIncludingTax,point_eligible AS pointEligible,point_status AS pointStatus,expires_at AS expiresAt FROM orders WHERE id=? AND member_id=?`).bind(orderId,member.id).first<{orderId:string;orderNumber:string;status:string;paymentMethod:"STORE"|"STRIPE";totalIncludingTax:number;pointEligible:number;pointStatus:string;expiresAt:number}>();
    if(!order)return NextResponse.json({error:"ORDER_NOT_FOUND"},{status:404});
    const fulfillments=await env.DB.prepare(`SELECT department,call_number AS callNumber,status FROM order_fulfillments WHERE order_id=? ORDER BY department`).bind(orderId).all<{department:Department;callNumber:number;status:string}>();
    const [schedule,units]=await Promise.all([getOrderSchedule(orderId),orderUnits(orderId)]);
    return NextResponse.json({...order,pointEligible:Boolean(order.pointEligible),paymentLabel:order.paymentMethod==="STRIPE"?"スマート決済":"現地決済",fulfillments:fulfillments.results.map(item=>({...item,label:departmentLabel[item.department]})),units,schedule,scheduleLabel:schedule?null:"提供予定時間を確認しています。しばらくお待ちください。"},{headers:{"Cache-Control":"no-store"}});
  }
  const result = await env.DB.prepare(
    `SELECT id, order_number AS orderNumber, status, payment_method AS paymentMethod, total_including_tax AS totalIncludingTax,
     point_eligible AS pointEligible, point_status AS pointStatus, points_earned AS pointsEarned,
     pickup_at AS pickupAt, expires_at AS expiresAt, created_at AS createdAt FROM orders WHERE member_id = ? ORDER BY created_at DESC LIMIT 20`,
  ).bind(member.id).all();
  return NextResponse.json({ orders: result.results });
}

export async function POST(request: NextRequest) {
  const member = await authenticatedLiveMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { items?: { productId?: string; quantity?: number }[]; pickupAt?: number; requestId?: string; paymentMethod?: "STORE"|"STRIPE" } | null;
  const requested = body?.items ?? [];
  const {products}=await getOrderProducts({timeoutMs:3_000,allowSnapshotFallback:true});
  const resolvedItems=await resolveOrderProducts(products,requested);
  const items = resolvedItems.filter((item): item is NonNullable<typeof item> => Boolean(item)&&!item.product.soldOut).map(item=>({product:item.product,quantity:item.quantity}));
  if (!items.length || items.length !== requested.length) return NextResponse.json({ error: "ORDER_ITEMS_REFRESH_REQUIRED",message:"商品情報が更新されました。最新の内容を読み込んでいます。もう一度ご確認ください。",refreshCatalog:true }, { status: 409 });
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const paymentMethod = body?.paymentMethod === "STRIPE" ? "STRIPE" : "STORE";
  const runtime = env as unknown as Record<string,string|undefined>;
  if (paymentMethod === "STRIPE" && runtime.SMART_PAYMENT_ENABLED !== "true") return NextResponse.json({ error:"SMART_PAYMENT_NOT_READY", message:"スマート決済は現在準備中です" }, { status:503 });
  const pointRule = pointRuleFor("MOBILE_ORDER");
  const requestId = body?.requestId?.match(/^[a-zA-Z0-9-]{10,80}$/) ? body.requestId : crypto.randomUUID();
  const id = `ord_${requestId}`;
  const existing = await env.DB.prepare(`SELECT member_id AS memberId,order_number AS orderNumber,status,payment_method AS paymentMethod,total_including_tax AS totalIncludingTax FROM orders WHERE id=?`).bind(id).first<{memberId:string;orderNumber:string;status:string;paymentMethod:string;totalIncludingTax:number}>();
  if(existing){
    if(existing.memberId!==member.id)return NextResponse.json({error:"ORDER_REQUEST_CONFLICT"},{status:409});
    const existingItems=await env.DB.prepare(`SELECT product_id AS productId,quantity FROM order_items WHERE order_id=? ORDER BY product_id,quantity`).bind(id).all<{productId:string;quantity:number}>(),requestedKey=items.map(item=>`${item.product.id}:${item.quantity}`).sort().join("|"),existingKey=existingItems.results.map(item=>`${item.productId}:${item.quantity}`).sort().join("|");
    if(existing.paymentMethod!==paymentMethod||existing.totalIncludingTax!==total||existingKey!==requestedKey)return NextResponse.json({error:"ORDER_REQUEST_CONFLICT",message:"前回送信した注文内容と一致しません。注文状況を確認してから再操作してください。"},{status:409});
    const [result,units,schedule]=await Promise.all([env.DB.prepare(`SELECT department,call_number AS callNumber,status FROM order_fulfillments WHERE order_id=? ORDER BY department`).bind(id).all(),orderUnits(id),getOrderSchedule(id)]);return NextResponse.json({orderId:id,orderNumber:existing.orderNumber,status:existing.status,paymentMethod:existing.paymentMethod,totalIncludingTax:existing.totalIncludingTax,fulfillments:result.results,units,schedule,scheduleLabel:schedule?null:"提供予定時間を確認しています。しばらくお待ちください。"});
  }
  const now = Date.now(); const orderNumber = `ORD-${String(now).slice(-8)}`; const expiresAt = now + 15 * 60_000;const callDate=kitchenBusinessDate(now);
  const itemRows=items.map(item=>({id:`item_${crypto.randomUUID()}`,...item}));
  const unitRows:{id:string;orderItemId:string;productName:string;department:Department;callNumber:number;unitIndex:number}[]=[];
  for(const item of itemRows)for(let unitIndex=1;unitIndex<=item.quantity;unitIndex++)unitRows.push({id:`ku_${crypto.randomUUID()}`,orderItemId:item.id,productName:item.product.name,department:item.product.category as Department,callNumber:await allocateKitchenUnitNumber(item.product.category as Department,callDate,now),unitIndex});
  const departments=[...new Set(unitRows.map(unit=>unit.department))];
  const fulfillments=departments.map(department=>{const first=unitRows.find(unit=>unit.department===department)!;return{department,callNumber:first.callNumber,status:"WAITING_PAYMENT" as const,label:departmentLabel[department]}});
  const scheduleItems=items.map(item=>({productId:item.product.id,productCode:item.product.code,name:item.product.name,quantity:item.quantity,department:item.product.category,preparationMinutes:item.product.preparationMinutes,options:[]}));
  const schedule=await estimateOrderSchedule(requestId,scheduleItems).catch(()=>null);const pickupAt=scheduleReadyAt(schedule);
  const statements=[env.DB.prepare(
    `INSERT INTO orders (id, order_number, member_id, status, payment_method, total_including_tax, point_eligible, point_status, pickup_at, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
  ).bind(id, orderNumber, member.id, paymentMethod === "STRIPE" ? "PENDING_PAYMENT" : "WAITING_STORE_PAYMENT", paymentMethod, total, pointRule.eligible ? 1 : 0, pickupAt, expiresAt, now, now),
  ...itemRows.map(item=>env.DB.prepare(`INSERT INTO order_items (id,order_id,product_id,product_code,product_name,department,quantity,unit_price_excluding_tax,unit_price_including_tax,tax_rate,tax_division,tax_rounding,preparation_minutes,selected_options_json,line_total_including_tax) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(item.id,id,item.product.id,item.product.code,item.product.name,item.product.category,item.quantity,excludingTax(item.product),item.product.price,item.product.taxRate||10,normalizedTaxDivision(item.product.taxDivision),normalizedTaxRounding(item.product.taxRounding),item.product.preparationMinutes,"[]",item.product.price*item.quantity)),
  ...fulfillments.map(item=>env.DB.prepare(`INSERT INTO order_fulfillments (id,order_id,department,call_date,call_number,status,updated_at) VALUES (?,?,?,?,?,'WAITING_PAYMENT',?)`).bind(crypto.randomUUID(),id,item.department,`LEGACY:${callDate}`,item.callNumber,now)),
  ...unitRows.map(unit=>env.DB.prepare(`INSERT INTO kitchen_units(id,order_id,order_item_id,unit_index,department,call_date,call_number,status,current_step,total_steps,is_test,updated_at) VALUES(?,?,?,?,?,?,?,'WAITING_PAYMENT',0,1,0,?)`).bind(unit.id,id,unit.orderItemId,unit.unitIndex,unit.department,callDate,unit.callNumber,now))];
  await env.DB.batch(statements);
  const units=await orderUnits(id);
  return NextResponse.json({ orderId: id, orderNumber, fulfillments, units, status: paymentMethod === "STRIPE" ? "PENDING_PAYMENT" : "WAITING_STORE_PAYMENT", paymentMethod, paymentLabel:paymentMethod === "STRIPE" ? "スマート決済" : "現地決済", pointEligible:pointRule.eligible, pointStatus:"PENDING", totalIncludingTax: total, expiresAt, schedule, scheduleLabel:schedule?null:"提供予定時間を確認しています。しばらくお待ちください。" }, { status: 201 });
}
