import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";

type Runtime={STRIPE_SECRET_KEY?:string;STRIPE_REFUND_ADMIN_TOKEN?:string};

export async function POST(request:NextRequest){
  const runtime=env as unknown as Runtime,token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
  if(!runtime.STRIPE_REFUND_ADMIN_TOKEN||token!==runtime.STRIPE_REFUND_ADMIN_TOKEN)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  if(!runtime.STRIPE_SECRET_KEY)return NextResponse.json({error:"STRIPE_NOT_CONFIGURED"},{status:503});
  const body=await request.json().catch(()=>null)as{orderId?:string;paymentIntentId?:string}|null,orderId=body?.orderId?.trim()??"",paymentIntentId=body?.paymentIntentId?.trim()??"";
  if(!/^ord_[A-Za-z0-9-]{20,80}$/.test(orderId)||!/^pi_[A-Za-z0-9]{16,80}$/.test(paymentIntentId))return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
  const order=await env.DB.prepare("SELECT id,order_number AS orderNumber,status,total_including_tax AS amount,stripe_payment_intent_id AS paymentIntentId FROM orders WHERE id=?").bind(orderId).first<{id:string;orderNumber:string;status:string;amount:number;paymentIntentId:string|null}>();
  if(!order||order.paymentIntentId!==paymentIntentId)return NextResponse.json({error:"ORDER_PAYMENT_MISMATCH"},{status:409});
  if(order.status==="REFUNDED")return NextResponse.json({ok:true,alreadyRefunded:true,orderNumber:order.orderNumber,amount:order.amount});
  const stripeBody=new URLSearchParams({payment_intent:paymentIntentId,reason:"requested_by_customer","metadata[order_id]":orderId});
  const stripe=await fetch("https://api.stripe.com/v1/refunds",{method:"POST",headers:{Authorization:`Bearer ${runtime.STRIPE_SECRET_KEY}`,"Content-Type":"application/x-www-form-urlencoded","Idempotency-Key":`refund-${orderId}`},body:stripeBody});
  const result=await stripe.json()as{ id?:string;status?:string;amount?:number;error?:{message?:string} };
  if(!stripe.ok)return NextResponse.json({error:"STRIPE_REFUND_FAILED",message:result.error?.message??"Refund failed"},{status:502});
  const now=Date.now();await env.DB.batch([env.DB.prepare("UPDATE orders SET status='REFUNDED',updated_at=? WHERE id=?").bind(now,orderId),env.DB.prepare("UPDATE order_fulfillments SET status='CANCELLED',updated_at=? WHERE order_id=? AND status NOT IN ('PICKED_UP','CANCELLED')").bind(now,orderId)]);
  return NextResponse.json({ok:true,refundId:result.id,status:result.status,amount:result.amount,orderNumber:order.orderNumber});
}
