import { env } from "cloudflare:workers";

export const PAYMENT_LOCK_TTL_MS=5*60_000;

export type PosOrderRow={id:string;orderNumber:string;memberCode:string;status:string;createdAt:number;expiresAt:number|null;pickupRequestedAt:number|null;totalIncludingTax:number;smaregiTransactionId:string|null};
export type PosOrderItem={productId:string;productCode:string;productName:string;quantity:number;priceExcludingTax:number;priceIncludingTax:number;taxRate:number;taxDivision:string;taxRounding:string;kitchenType:"FOOD"|"DRINK";preparationMinutes:number;selectedOptionsJson:string};

export async function expireStaleOrder(orderId?:string){
 const now=Date.now();const suffix=orderId?" AND id=?":"";const bindings=orderId?[now,orderId]:[now];
 const stale=await env.DB.prepare(`SELECT id FROM orders WHERE payment_method='STORE' AND status='WAITING_STORE_PAYMENT' AND expires_at<?${suffix}`).bind(...bindings).all<{id:string}>();
 if(!stale.results.length)return;
 await env.DB.batch(stale.results.flatMap(row=>[env.DB.prepare(`UPDATE orders SET status='EXPIRED',updated_at=? WHERE id=? AND status='WAITING_STORE_PAYMENT'`).bind(now,row.id),env.DB.prepare(`UPDATE order_fulfillments SET status='CANCELLED',updated_at=? WHERE order_id=? AND status='WAITING_PAYMENT'`).bind(now,row.id)]));
}

export async function reconcileCompletedOrders(memberId?:string){
 const now=Date.now(),suffix=memberId?" AND member_id=?":"",bindings=memberId?[now,memberId]:[now];
 await env.DB.prepare(`UPDATE orders SET status='PICKED_UP',updated_at=? WHERE status IN ('PAID','ACCEPTED','COOKING','READY')${suffix} AND EXISTS (SELECT 1 FROM order_fulfillments f WHERE f.order_id=orders.id) AND NOT EXISTS (SELECT 1 FROM order_fulfillments f WHERE f.order_id=orders.id AND f.status NOT IN ('PICKED_UP','CANCELLED'))`).bind(...bindings).run();
}

export async function expireStaleLocks(orderId?:string){
 const now=Date.now();const suffix=orderId?" AND order_id=?":"";const bindings=orderId?[now,orderId]:[now];
 const stale=await env.DB.prepare(`SELECT id,order_id AS orderId FROM order_payment_locks WHERE status='ACTIVE' AND expires_at<=?${suffix}`).bind(...bindings).all<{id:string;orderId:string}>();
 if(!stale.results.length)return;
 await env.DB.batch(stale.results.flatMap(row=>[env.DB.prepare(`UPDATE order_payment_locks SET status='EXPIRED',released_at=?,release_reason='TIMEOUT' WHERE id=? AND status='ACTIVE'`).bind(now,row.id),env.DB.prepare(`UPDATE orders SET status=CASE WHEN expires_at>? THEN 'WAITING_STORE_PAYMENT' ELSE 'EXPIRED' END,updated_at=? WHERE id=? AND status='PAYMENT_PROCESSING'`).bind(now,now,row.orderId),env.DB.prepare(`UPDATE order_fulfillments SET status=CASE WHEN (SELECT status FROM orders WHERE id=?)='EXPIRED' THEN 'CANCELLED' ELSE status END,updated_at=? WHERE order_id=? AND status='WAITING_PAYMENT'`).bind(row.orderId,now,row.orderId)]));
}

export async function orderDetails(order:PosOrderRow){
 const items=await env.DB.prepare(`SELECT product_id AS productId,product_code AS productCode,product_name AS productName,quantity,unit_price_excluding_tax AS priceExcludingTax,unit_price_including_tax AS priceIncludingTax,tax_rate AS taxRate,tax_division AS taxDivision,tax_rounding AS taxRounding,department AS kitchenType,preparation_minutes AS preparationMinutes,selected_options_json AS selectedOptionsJson FROM order_items WHERE order_id=? ORDER BY rowid`).bind(order.id).all<PosOrderItem>();
 const normalized=items.results.map(item=>({...item,selectedOptions:safeOptions(item.selectedOptionsJson)}));
 const subtotalExcludingTax=normalized.reduce((sum,item)=>sum+item.priceExcludingTax*item.quantity+item.selectedOptions.reduce((optionSum,option)=>optionSum+(option.priceExcludingTax??0)*item.quantity,0),0);
 const calls=await env.DB.prepare(`SELECT department,call_number AS callNumber,status FROM order_fulfillments WHERE order_id=? ORDER BY department`).bind(order.id).all<{department:"FOOD"|"DRINK";callNumber:number;status:string}>();const food=calls.results.find(item=>item.department==="FOOD"),drink=calls.results.find(item=>item.department==="DRINK");
 return{orderId:order.id,orderNumber:order.orderNumber,memberCode:order.memberCode,status:order.status==="WAITING_STORE_PAYMENT"?"UNPAID":order.status,createdAt:new Date(order.createdAt).toISOString(),expiresAt:order.expiresAt?new Date(order.expiresAt).toISOString():null,pickupRequestedAt:order.pickupRequestedAt?new Date(order.pickupRequestedAt).toISOString():null,foodCallNumber:food?`F${String(food.callNumber).padStart(3,"0")}`:null,drinkCallNumber:drink?`D${String(drink.callNumber).padStart(3,"0")}`:null,fulfillments:calls.results,items:normalized.map(({selectedOptionsJson,...item})=>item),subtotalExcludingTax,taxAmount:order.totalIncludingTax-subtotalExcludingTax,totalIncludingTax:order.totalIncludingTax};
}

function safeOptions(value:string){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}}

export function posOrderError(error:string,status:number,message?:string){return Response.json({ok:false,error,message:message??error},{status})}
