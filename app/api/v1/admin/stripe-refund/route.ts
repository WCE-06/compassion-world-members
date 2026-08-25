import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";

type Runtime={STRIPE_SECRET_KEY?:string;STRIPE_REFUND_ADMIN_TOKEN?:string;APPROVED_REFUND_ORDER_ID?:string;APPROVED_REFUND_PAYMENT_INTENT_ID?:string;APPROVED_REFUND_AMOUNT?:string};

export async function POST(request:NextRequest){
  const runtime=env as unknown as Runtime,token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
  if(!runtime.STRIPE_REFUND_ADMIN_TOKEN||token!==runtime.STRIPE_REFUND_ADMIN_TOKEN)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  if(!runtime.STRIPE_SECRET_KEY)return NextResponse.json({error:"STRIPE_NOT_CONFIGURED"},{status:503});
  const orderId=runtime.APPROVED_REFUND_ORDER_ID??"",paymentIntentId=runtime.APPROVED_REFUND_PAYMENT_INTENT_ID??"",approvedAmount=Number(runtime.APPROVED_REFUND_AMOUNT);
  if(!orderId||!paymentIntentId||!Number.isSafeInteger(approvedAmount))return NextResponse.json({error:"APPROVED_REFUND_NOT_CONFIGURED"},{status:503});
  const order=await env.DB.prepare("SELECT id,order_number AS orderNumber,status,total_including_tax AS amount,stripe_payment_intent_id AS paymentIntentId FROM orders WHERE id=?").bind(orderId).first<{id:string;orderNumber:string;status:string;amount:number;paymentIntentId:string|null}>();
  if(!order||order.paymentIntentId!==paymentIntentId||order.amount!==approvedAmount)return NextResponse.json({error:"ORDER_PAYMENT_MISMATCH"},{status:409});
  if(order.status==="REFUNDED")return NextResponse.json({ok:true,alreadyRefunded:true,orderNumber:order.orderNumber,amount:order.amount});
  const stripeBody=new URLSearchParams({payment_intent:paymentIntentId,reason:"requested_by_customer","metadata[order_id]":orderId});
  const stripe=await fetch("https://api.stripe.com/v1/refunds",{method:"POST",headers:{Authorization:`Bearer ${runtime.STRIPE_SECRET_KEY}`,"Content-Type":"application/x-www-form-urlencoded","Idempotency-Key":`refund-${orderId}`},body:stripeBody});
  const result=await stripe.json()as{ id?:string;status?:string;amount?:number;error?:{message?:string} };
  if(!stripe.ok)return NextResponse.json({error:"STRIPE_REFUND_FAILED",message:result.error?.message??"Refund failed"},{status:502});
  const now=Date.now();await env.DB.batch([env.DB.prepare("UPDATE orders SET status='REFUNDED',updated_at=? WHERE id=?").bind(now,orderId),env.DB.prepare("UPDATE order_fulfillments SET status='CANCELLED',updated_at=? WHERE order_id=? AND status NOT IN ('PICKED_UP','CANCELLED')").bind(now,orderId)]);
  return NextResponse.json({ok:true,refundId:result.id,status:result.status,amount:result.amount,orderNumber:order.orderNumber});
}
