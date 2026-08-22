import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";
import { stripeConfigured, stripeRequest } from "@/lib/stripe";

type CheckoutSession={id:string;url:string|null};
type StripeCustomer={id:string};

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"MEMBER_LOGIN_REQUIRED"},{status:401});
 if(!stripeConfigured())return NextResponse.json({error:"SMART_PAYMENT_NOT_READY",message:"スマート決済は現在準備中です"},{status:503});
 const {id}=await params;const order=await env.DB.prepare(`SELECT id,status,total_including_tax AS total, stripe_checkout_session_id AS checkoutSessionId FROM orders WHERE id=? AND member_id=? AND payment_method='STRIPE'`).bind(id,member.id).first<{id:string;status:string;total:number;checkoutSessionId:string|null}>();
 if(!order)return NextResponse.json({error:"ORDER_NOT_FOUND"},{status:404});if(order.status!=="PENDING_PAYMENT"&&order.status!=="PAYMENT_PROCESSING")return NextResponse.json({error:"ORDER_NOT_PAYABLE"},{status:409});
 if(order.checkoutSessionId){const existing=await stripeRequest<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(order.checkoutSessionId)}`);if(existing.url)return NextResponse.json({checkoutUrl:existing.url,sessionId:existing.id});}
 const items=await env.DB.prepare(`SELECT product_name AS name,quantity,unit_price_including_tax AS unitAmount FROM order_items WHERE order_id=? ORDER BY rowid`).bind(id).all<{name:string;quantity:number;unitAmount:number}>();
 let customer=await env.DB.prepare(`SELECT stripe_customer_id AS customerId FROM stripe_customers WHERE member_id=?`).bind(member.id).first<{customerId:string}>();if(!customer?.customerId){const created=await stripeRequest<StripeCustomer>("/customers","POST",new URLSearchParams({"metadata[member_id]":member.id,description:"COMPASSION WORLD member"}));await env.DB.prepare(`INSERT INTO stripe_customers (member_id,stripe_customer_id,updated_at) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,updated_at=excluded.updated_at`).bind(member.id,created.id,Date.now()).run();customer={customerId:created.id};}const base=(env as unknown as Record<string,string|undefined>).APP_BASE_URL??request.nextUrl.origin;
 const form=new URLSearchParams({mode:"payment",customer:customer.customerId,success_url:`${base}/mobile-order?payment=success&orderId=${encodeURIComponent(id)}`,cancel_url:`${base}/mobile-order?payment=cancelled&orderId=${encodeURIComponent(id)}`,"saved_payment_method_options[payment_method_save]":"enabled","metadata[purpose]":"MOBILE_ORDER","metadata[order_id]":id,"metadata[member_id]":member.id,"payment_intent_data[metadata][purpose]":"MOBILE_ORDER","payment_intent_data[metadata][order_id]":id,"payment_intent_data[metadata][member_id]":member.id});
 items.results.forEach((item,index)=>{form.set(`line_items[${index}][price_data][currency]`,`jpy`);form.set(`line_items[${index}][price_data][product_data][name]`,item.name);form.set(`line_items[${index}][price_data][unit_amount]`,String(item.unitAmount));form.set(`line_items[${index}][quantity]`,String(item.quantity))});
 const session=await stripeRequest<CheckoutSession>("/checkout/sessions","POST",form);await env.DB.prepare(`UPDATE orders SET stripe_checkout_session_id=?,status='PAYMENT_PROCESSING',updated_at=? WHERE id=? AND status='PENDING_PAYMENT'`).bind(session.id,Date.now(),id).run();
 return NextResponse.json({checkoutUrl:session.url,sessionId:session.id});
}
