import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { stripeRequest } from "@/lib/stripe";

type Body={orderId?:string;requestId?:string;reason?:string};
type Order={id:string;orderNumber:string;status:string;paymentMethod:string;paymentIntent:string|null;memberId:string};
type Refund={id:string;status:string};

export async function POST(request:NextRequest){
 const actor=await requireAdminSession(request);if(!actor)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const body=await request.json().catch(()=>null) as Body|null,orderId=String(body?.orderId??"").trim(),requestId=String(body?.requestId??"").trim(),reason=String(body?.reason??"お客さま都合").trim().slice(0,160);
 if(!/^ord_[A-Za-z0-9-]{10,80}$/.test(orderId)||requestId.length<8||requestId.length>160)return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
 const replay=await env.DB.prepare("SELECT details_json AS details FROM member_registration_events WHERE event_type='ORDER_ADMIN_CANCELLED' AND details_json LIKE ? LIMIT 1").bind(`%\"requestId\":\"${requestId.replace(/[\\%_]/g,"\\$&")}\"%`).first<{details:string}>();
 if(replay)return NextResponse.json({ok:true,idempotentReplay:true,...JSON.parse(replay.details)});
 const order=await env.DB.prepare(`SELECT id,order_number AS orderNumber,status,payment_method AS paymentMethod,stripe_payment_intent_id AS paymentIntent,member_id AS memberId FROM orders WHERE id=?`).bind(orderId).first<Order>();
 if(!order)return NextResponse.json({error:"ORDER_NOT_FOUND"},{status:404});
 if(order.status==="REFUNDED"||order.status==="CANCELLED")return NextResponse.json({ok:true,orderId,status:order.status,idempotentReplay:true});
 let refundId:string|null=null,nextStatus="CANCELLED";
 if(order.paymentIntent){
  const refund=await stripeRequest<Refund>("/refunds","POST",new URLSearchParams({payment_intent:order.paymentIntent,reason:"requested_by_customer","metadata[order_id]":order.id}),`admin-refund:${order.id}`);
  refundId=refund.id;nextStatus=refund.status==="succeeded"?"REFUNDED":"REFUND_PENDING";
 }
 const now=Date.now(),details={requestId,orderId,orderNumber:order.orderNumber,before:order.status,after:nextStatus,reason,refundId};
 await env.DB.prepare("UPDATE orders SET status=?,point_eligible=0,point_status='CANCELLED',updated_at=? WHERE id=?").bind(nextStatus,now,order.id).run();
 await Promise.allSettled([
  env.DB.prepare("UPDATE order_fulfillments SET status='CANCELLED',updated_at=? WHERE order_id=? AND status<>'PICKED_UP'").bind(now,order.id).run(),
  env.DB.prepare("UPDATE kitchen_units SET status='CANCELLED',updated_at=? WHERE order_id=? AND status<>'PICKED_UP'").bind(now,order.id).run(),
  env.DB.prepare("UPDATE order_payment_locks SET status='RELEASED',released_at=?,release_reason='ADMIN_CANCELLED' WHERE order_id=? AND status='ACTIVE'").bind(now,order.id).run(),
  env.DB.prepare("UPDATE payment_point_events SET eligible=0,updated_at=? WHERE purpose='MOBILE_ORDER' AND source_id=?").bind(now,order.id).run(),
  env.DB.prepare("INSERT INTO member_registration_events (id,member_id,event_type,actor,details_json,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),order.memberId,"ORDER_ADMIN_CANCELLED",actor,JSON.stringify(details),now).run()
 ]);
 return NextResponse.json({ok:true,...details});
}
