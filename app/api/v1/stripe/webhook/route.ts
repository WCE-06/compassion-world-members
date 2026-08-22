import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { stripeRequest, verifyStripeWebhook } from "@/lib/stripe";

type StripeEvent={id:string;type:string;data:{object:Record<string,unknown>}};
type PaymentIntent={id:string;payment_method?:string|Record<string,unknown>;setup_future_usage?:"on_session"|"off_session"|null};
type PaymentMethod={id:string;customer?:string|null;card?:{brand?:string;last4?:string;exp_month?:number;exp_year?:number}};

async function completeCheckout(object:Record<string,unknown>,eventId:string){
 const metadata=(object.metadata??{}) as Record<string,string>;if(metadata.purpose!=="MOBILE_ORDER"||!metadata.order_id||!metadata.member_id)return false;
 const paymentIntent=String(object.payment_intent??"");const customer=String(object.customer??"");if(!paymentIntent||!customer)return false;const now=Date.now();
 await env.DB.batch([env.DB.prepare(`UPDATE orders SET status='PAID',stripe_payment_intent_id=?,updated_at=? WHERE id=? AND member_id=? AND status IN ('PENDING_PAYMENT','PAYMENT_PROCESSING')`).bind(paymentIntent,now,metadata.order_id,metadata.member_id),env.DB.prepare(`UPDATE order_fulfillments SET status='ACCEPTED',updated_at=? WHERE order_id=? AND status='WAITING_PAYMENT'`).bind(now,metadata.order_id),env.DB.prepare(`INSERT OR IGNORE INTO payment_point_events (id,idempotency_key,member_id,purpose,source_id,stripe_event_id,stripe_payment_id,eligible,status,points,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,'RECEIVED',0,?,?)`).bind(crypto.randomUUID(),`stripe:${paymentIntent}`,metadata.member_id,"MOBILE_ORDER",metadata.order_id,eventId,paymentIntent,now,now)]);
 const intent=await stripeRequest<PaymentIntent>(`/payment_intents/${encodeURIComponent(paymentIntent)}`);const paymentMethodId=typeof intent.payment_method==="string"?intent.payment_method:"";if(paymentMethodId){const method=await stripeRequest<PaymentMethod>(`/payment_methods/${encodeURIComponent(paymentMethodId)}`);const savedForReuse=intent.setup_future_usage==="off_session"||method.customer===customer;if(savedForReuse)await env.DB.prepare(`INSERT INTO stripe_customers (member_id,stripe_customer_id,default_payment_method_id,card_brand,card_last4,card_exp_month,card_exp_year,reusable_consent_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,default_payment_method_id=excluded.default_payment_method_id,card_brand=excluded.card_brand,card_last4=excluded.card_last4,card_exp_month=excluded.card_exp_month,card_exp_year=excluded.card_exp_year,reusable_consent_at=excluded.reusable_consent_at,updated_at=excluded.updated_at`).bind(metadata.member_id,customer,paymentMethodId,method.card?.brand??null,method.card?.last4??null,method.card?.exp_month??null,method.card?.exp_year??null,now,now).run();}
 return true;
}

export async function POST(request:NextRequest){
 const payload=await request.text();if(!await verifyStripeWebhook(payload,request.headers.get("stripe-signature")))return NextResponse.json({error:"INVALID_SIGNATURE"},{status:400});
 const event=JSON.parse(payload) as StripeEvent;const exists=await env.DB.prepare(`SELECT event_id FROM stripe_webhook_events WHERE event_id=?`).bind(event.id).first();if(exists)return NextResponse.json({received:true,duplicate:true});const now=Date.now();await env.DB.prepare(`INSERT INTO stripe_webhook_events (event_id,event_type,status,created_at) VALUES (?,?,'RECEIVED',?)`).bind(event.id,event.type,now).run();
 try{let handled=false;if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded")handled=await completeCheckout(event.data.object,event.id);else if(event.type==="checkout.session.async_payment_failed"||event.type==="checkout.session.expired"){const metadata=(event.data.object.metadata??{}) as Record<string,string>;if(metadata.order_id){await env.DB.prepare(`UPDATE orders SET status='PAYMENT_FAILED',updated_at=? WHERE id=? AND status IN ('PENDING_PAYMENT','PAYMENT_PROCESSING')`).bind(now,metadata.order_id).run();handled=true;}}
 await env.DB.prepare(`UPDATE stripe_webhook_events SET status=?,processed_at=? WHERE event_id=?`).bind(handled?"PROCESSED":"IGNORED",Date.now(),event.id).run();return NextResponse.json({received:true});
 }catch(error){await env.DB.prepare(`UPDATE stripe_webhook_events SET status='FAILED',error_message=?,processed_at=? WHERE event_id=?`).bind(error instanceof Error?error.message:"UNKNOWN",Date.now(),event.id).run();return NextResponse.json({error:"WEBHOOK_PROCESSING_FAILED"},{status:500});}
}
