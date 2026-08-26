import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { requirePosToken } from "@/lib/pos-api";
import { expireStaleLocks } from "@/lib/order-pos";
import { confirmOrderSchedule } from "@/lib/kitchen-schedule";
import { orderUnits } from "@/lib/kitchen-units";
import { ensureOrderAcceptedNotice } from "@/lib/order-notifications";

type Body={orderId?:string;paymentId?:string;requestId?:string;lockId?:string;deviceId?:string;paidAt?:string|number};

async function success(orderId:string,paymentId:string,idempotentReplay:boolean){
 await ensureOrderAcceptedNotice(orderId);
 const fulfillments=await env.DB.prepare(`SELECT department,call_number AS callNumber,status FROM order_fulfillments WHERE order_id=? ORDER BY department`).bind(orderId).all<{department:"FOOD"|"DRINK";callNumber:number;status:string}>();const food=fulfillments.results.find(item=>item.department==="FOOD"),drink=fulfillments.results.find(item=>item.department==="DRINK");
 const units=await orderUnits(orderId);const schedule=await confirmOrderSchedule(orderId,idempotentReplay?"決済完了予定の再同期":"セルフレジ決済完了時の確定計算").catch(()=>null);
 if(!schedule)return NextResponse.json({ok:false,error:"KITCHEN_SCHEDULE_PENDING",message:"決済は完了しました。提供予定の同期を再試行してください",paymentConfirmed:true,orderId,paymentId,retryable:true},{status:503});
 return NextResponse.json({ok:true,orderId,paymentId,orderStatus:"PAID",kitchenStatus:units.every(item=>item.status==="ACCEPTED")?"ACCEPTED":"PARTIAL",foodCallNumber:food?`F${String(food.callNumber).padStart(3,"0")}`:null,drinkCallNumber:drink?`D${String(drink.callNumber).padStart(3,"0")}`:null,idempotentReplay,fulfillments:fulfillments.results,units,schedule});
}

export async function POST(request:NextRequest){
 if(!await requirePosToken(request))return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});
 const body=await request.json().catch(()=>null) as Body|null;const orderId=body?.orderId?.trim()??"",paymentId=body?.paymentId?.trim()??"",requestId=body?.requestId?.trim()||`legacy:${orderId}:${paymentId}`,lockId=body?.lockId?.trim()??"",deviceId=body?.deviceId?.trim()??"";
 if(!/^ord_[A-Za-z0-9-]{10,80}$/.test(orderId))return NextResponse.json({ok:false,error:"INVALID_REQUEST"},{status:400});if(!paymentId||paymentId.length>120)return NextResponse.json({ok:false,error:"PAYMENT_ID_REQUIRED"},{status:400});if(requestId.length>160)return NextResponse.json({ok:false,error:"INVALID_REQUEST"},{status:400});
 const replay=await env.DB.prepare(`SELECT order_id AS orderId,payment_id AS paymentId FROM order_payment_events WHERE request_id=?`).bind(requestId).first<{orderId:string;paymentId:string}>();if(replay){if(replay.orderId!==orderId||replay.paymentId!==paymentId)return NextResponse.json({ok:false,error:"PAYMENT_CONFIRMATION_CONFLICT"},{status:409});return success(orderId,paymentId,true);}
 await expireStaleLocks(orderId);const order=await env.DB.prepare(`SELECT status,smaregi_transaction_id AS paymentId FROM orders WHERE id=?`).bind(orderId).first<{status:string;paymentId:string|null}>();if(!order)return NextResponse.json({ok:false,error:"ORDER_NOT_FOUND"},{status:404});if(order.status==="CANCELLED")return NextResponse.json({ok:false,error:"ORDER_CANCELLED"},{status:409});if(order.status==="EXPIRED")return NextResponse.json({ok:false,error:"ORDER_EXPIRED"},{status:410});if(order.status==="PAID"){if(order.paymentId===paymentId)return success(orderId,paymentId,true);return NextResponse.json({ok:false,error:"ORDER_ALREADY_PAID"},{status:409});}
 const duplicate=await env.DB.prepare(`SELECT id FROM orders WHERE smaregi_transaction_id=? AND id<>?`).bind(paymentId,orderId).first();if(duplicate)return NextResponse.json({ok:false,error:"DUPLICATE_PAYMENT_ID"},{status:409});
 if(order.status==="PAYMENT_PROCESSING"||order.status==="PAYMENT_RECONCILING"){
  if(!lockId||!deviceId)return NextResponse.json({ok:false,error:"LOCK_NOT_OWNED"},{status:409});
  const lock=await env.DB.prepare(`SELECT status,device_id AS deviceId,expires_at AS expiresAt,release_reason AS releaseReason FROM order_payment_locks WHERE id=? AND order_id=?`).bind(lockId,orderId).first<{status:string;deviceId:string;expiresAt:number;releaseReason:string|null}>();
  if(!lock||lock.deviceId!==deviceId)return NextResponse.json({ok:false,error:"LOCK_NOT_OWNED"},{status:409});
  const lateProcessorCompletion=order.status==="PAYMENT_RECONCILING"&&lock.status==="RELEASED"&&lock.releaseReason==="CUSTOMER_CANCELLED";
  if(!lateProcessorCompletion&&(lock.status==="EXPIRED"||lock.expiresAt<=Date.now()))return NextResponse.json({ok:false,error:"LOCK_EXPIRED"},{status:409});
  if(!lateProcessorCompletion&&lock.status!=="ACTIVE")return NextResponse.json({ok:false,error:"LOCK_NOT_OWNED"},{status:409});
 }
 else if(order.status!=="WAITING_STORE_PAYMENT")return NextResponse.json({ok:false,error:"PAYMENT_CONFIRMATION_CONFLICT"},{status:409});
 const paidAt=typeof body?.paidAt==="number"?body.paidAt:body?.paidAt?Date.parse(body.paidAt):Date.now(),now=Date.now();if(!Number.isFinite(paidAt))return NextResponse.json({ok:false,error:"INVALID_REQUEST"},{status:400});const eventId=crypto.randomUUID();
 await env.DB.batch([env.DB.prepare(`UPDATE orders SET status='PAID',smaregi_transaction_id=?,updated_at=? WHERE id=? AND status IN ('WAITING_STORE_PAYMENT','PAYMENT_PROCESSING','PAYMENT_RECONCILING')`).bind(paymentId,now,orderId),env.DB.prepare(`UPDATE order_fulfillments SET status='ACCEPTED',updated_at=? WHERE order_id=? AND status='WAITING_PAYMENT' AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status='PAID' AND smaregi_transaction_id=?)`).bind(now,orderId,orderId,paymentId),env.DB.prepare(`UPDATE kitchen_units SET status='ACCEPTED',updated_at=? WHERE order_id=? AND status='WAITING_PAYMENT' AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status='PAID' AND smaregi_transaction_id=?)`).bind(now,orderId,orderId,paymentId),env.DB.prepare(`INSERT INTO order_payment_events (id,request_id,order_id,payment_id,lock_id,device_id,paid_at,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=? AND status='PAID' AND smaregi_transaction_id=?)`).bind(eventId,requestId,orderId,paymentId,lockId||null,deviceId||null,paidAt,now,orderId,paymentId),env.DB.prepare(`UPDATE order_payment_locks SET status='CONSUMED',released_at=?,release_reason='PAYMENT_CONFIRMED' WHERE id=? AND order_id=? AND status IN ('ACTIVE','RELEASED') AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status='PAID' AND smaregi_transaction_id=?)`).bind(now,lockId,orderId,orderId,paymentId)]);
 const confirmed=await env.DB.prepare(`SELECT status,smaregi_transaction_id AS paymentId FROM orders WHERE id=?`).bind(orderId).first<{status:string;paymentId:string|null}>();
 if(confirmed?.status!=="PAID"||confirmed.paymentId!==paymentId)return NextResponse.json({ok:false,error:"ORDER_ALREADY_PAID"},{status:409});
 return success(orderId,paymentId,false);
}
