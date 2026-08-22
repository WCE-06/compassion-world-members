import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { requirePosToken } from "@/lib/pos-api";

export async function POST(request:NextRequest){
  if(!await requirePosToken(request))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  const body=await request.json().catch(()=>null) as {orderId?:string;paymentId?:string}|null;
  const orderId=body?.orderId?.trim()??"",paymentId=body?.paymentId?.trim()??"";
  if(!/^ord_[A-Za-z0-9-]{10,80}$/.test(orderId)||!paymentId||paymentId.length>120)return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
  const order=await env.DB.prepare(`SELECT status FROM orders WHERE id=?`).bind(orderId).first<{status:string}>();
  if(!order)return NextResponse.json({error:"ORDER_NOT_FOUND"},{status:404});
  const duplicate=await env.DB.prepare(`SELECT id FROM orders WHERE smaregi_transaction_id=? AND id<>?`).bind(paymentId,orderId).first();
  if(duplicate)return NextResponse.json({error:"PAYMENT_ALREADY_USED"},{status:409});
  const now=Date.now();
  if(order.status==="WAITING_STORE_PAYMENT"||order.status==="PENDING_PAYMENT"||order.status==="PAYMENT_PROCESSING")await env.DB.batch([
    env.DB.prepare(`UPDATE orders SET status='PAID',smaregi_transaction_id=?,updated_at=? WHERE id=? AND status IN ('WAITING_STORE_PAYMENT','PENDING_PAYMENT','PAYMENT_PROCESSING')`).bind(paymentId,now,orderId),
    env.DB.prepare(`UPDATE order_fulfillments SET status='ACCEPTED',updated_at=? WHERE order_id=? AND status='WAITING_PAYMENT'`).bind(now,orderId),
  ]);
  const result=await env.DB.prepare(`SELECT department,call_number AS callNumber,status FROM order_fulfillments WHERE order_id=? ORDER BY department`).bind(orderId).all();
  return NextResponse.json({orderId,paymentId,status:"PAID",fulfillments:result.results});
}
