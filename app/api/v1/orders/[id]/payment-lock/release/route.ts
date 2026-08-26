import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { requirePosToken } from "@/lib/pos-api";
import { expireStaleLocks } from "@/lib/order-pos";

type Body={requestId?:string;lockId?:string;deviceId?:string;reason?:string};
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(!await requirePosToken(request))return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});const {id}=await params;const body=await request.json().catch(()=>null) as Body|null;const requestId=body?.requestId?.trim()??"",lockId=body?.lockId?.trim()??"",deviceId=body?.deviceId?.trim()??"";if(!requestId||!lockId||!deviceId)return NextResponse.json({ok:false,error:"INVALID_REQUEST"},{status:400});
 await expireStaleLocks(id);const lock=await env.DB.prepare(`SELECT status,device_id AS deviceId,request_id AS requestId,expires_at AS expiresAt FROM order_payment_locks WHERE id=? AND order_id=?`).bind(lockId,id).first<{status:string;deviceId:string;requestId:string;expiresAt:number}>();if(!lock)return NextResponse.json({ok:false,error:"LOCK_NOT_OWNED"},{status:409});if(lock.deviceId!==deviceId||lock.requestId!==requestId)return NextResponse.json({ok:false,error:"LOCK_NOT_OWNED"},{status:409});if(lock.status==="EXPIRED")return NextResponse.json({ok:false,error:"LOCK_EXPIRED"},{status:409});if(lock.status==="RELEASED")return NextResponse.json({ok:true,orderId:id,lockId,released:true,idempotentReplay:true});if(lock.status!=="ACTIVE")return NextResponse.json({ok:false,error:"ORDER_ALREADY_PAID"},{status:409});
 const now=Date.now(),reason=(body?.reason??"CLIENT_RELEASED").slice(0,80),paymentMayBeInFlight=reason==="CUSTOMER_CANCELLED";
 await env.DB.batch([
  env.DB.prepare(`UPDATE order_payment_locks SET status='RELEASED',released_at=?,release_reason=? WHERE id=? AND status='ACTIVE'`).bind(now,reason,lockId),
  env.DB.prepare(`UPDATE orders SET status=CASE WHEN ?=1 THEN 'PAYMENT_RECONCILING' WHEN expires_at>? THEN 'WAITING_STORE_PAYMENT' ELSE 'EXPIRED' END,updated_at=? WHERE id=? AND status='PAYMENT_PROCESSING'`).bind(paymentMayBeInFlight?1:0,now,now,id),
  env.DB.prepare(`UPDATE order_fulfillments SET status=CASE WHEN (SELECT status FROM orders WHERE id=?)='EXPIRED' THEN 'CANCELLED' ELSE status END,updated_at=? WHERE order_id=? AND status='WAITING_PAYMENT'`).bind(id,now,id)
 ]);
 return NextResponse.json({ok:true,orderId:id,lockId,released:true,reconciliationPending:paymentMayBeInFlight,idempotentReplay:false});
}
