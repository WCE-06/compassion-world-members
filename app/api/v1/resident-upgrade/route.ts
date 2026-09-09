import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedLiveMember as authenticatedMember } from "@/lib/member-auth";
import { stripeConfigured, stripeRequest } from "@/lib/stripe";
import { residentPrice, residentSubscriptionActive, subscriptionsForCustomer, syncResidentSubscription } from "@/lib/resident-subscription";

type StripeCustomer={id:string};type StripeList<T>={data:T[]};type CheckoutSession={id:string;url:string|null};
function message(code:string){return ({RESIDENT_PRICE_NOT_FOUND:"月額3,278円の住民プランを確認できませんでした。",RESIDENT_PRICE_AMBIGUOUS:"月額3,278円の住民プランが複数あります。管理者の確認が必要です。",RESIDENT_PRICE_CONFIGURATION_MISMATCH:"住民プランの料金設定が一致しません。",STRIPE_CUSTOMER_AMBIGUOUS:"同じメールアドレスの契約情報が複数あります。二重契約防止のためスタッフが確認します。"} as Record<string,string>)[code]??"住民登録のお申し込みを準備できませんでした。"}

export async function POST(request:NextRequest){
 if(!request.headers.get("authorization")?.startsWith("Bearer "))return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"MEMBER_LOGIN_REQUIRED"},{status:401});
 if(!stripeConfigured())return NextResponse.json({error:"RESIDENT_SUBSCRIPTION_NOT_CONFIGURED",message:"住民登録のお申し込みは現在準備中です。"},{status:503});
 try{
  const price=await residentPrice();let mapping=await env.DB.prepare("SELECT stripe_customer_id AS customerId FROM stripe_customers WHERE member_id=? LIMIT 1").bind(member.id).first<{customerId:string}>();
  if(!mapping?.customerId){const row=await env.DB.prepare("SELECT email,display_name AS displayName,member_code AS memberCode FROM members WHERE id=? LIMIT 1").bind(member.id).first<{email:string|null;displayName:string;memberCode:string}>();let customer:StripeCustomer|undefined;if(row?.email){const found=await stripeRequest<StripeList<StripeCustomer>>(`/customers?email=${encodeURIComponent(row.email)}&limit=3`);if(found.data.length===1)customer=found.data[0];else if(found.data.length>1)throw new Error("STRIPE_CUSTOMER_AMBIGUOUS");}if(!customer){const form=new URLSearchParams({description:`COMPASSION WORLD ${row?.displayName??"member"}`,"metadata[member_id]":member.id,"metadata[member_code]":row?.memberCode??""});if(row?.email)form.set("email",row.email);customer=await stripeRequest<StripeCustomer>("/customers","POST",form,`resident-customer:${member.id}`);}await env.DB.prepare("INSERT INTO stripe_customers (member_id,stripe_customer_id,updated_at) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,updated_at=excluded.updated_at").bind(member.id,customer.id,Date.now()).run();mapping={customerId:customer.id};}
  const existing=(await subscriptionsForCustomer(mapping.customerId)).find(subscription=>subscription.items?.data?.some(item=>item.price?.id===price.id)&&residentSubscriptionActive(subscription.status));
  if(existing){await syncResidentSubscription(existing,`upgrade-check:${crypto.randomUUID()}`);return NextResponse.json({alreadyActive:true,redirectUrl:"/resident?subscription=active"},{headers:{"Cache-Control":"no-store"}})}
  const base=((env as unknown as Record<string,string|undefined>).MEMBERS_CANONICAL_BASE_URL??request.nextUrl.origin).replace(/\/$/,""),form=new URLSearchParams({mode:"subscription",customer:mapping.customerId,success_url:`${base}/resident?subscription=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${base}/resident?subscription=cancelled`,"line_items[0][price]":price.id,"line_items[0][quantity]":"1",client_reference_id:member.id,"metadata[purpose]":"RESIDENT_SUBSCRIPTION","metadata[member_id]":member.id,"metadata[price_id]":price.id,"subscription_data[metadata][purpose]":"RESIDENT_SUBSCRIPTION","subscription_data[metadata][member_id]":member.id,"subscription_data[metadata][price_id]":price.id,allow_promotion_codes:"false"});
  const session=await stripeRequest<CheckoutSession>("/checkout/sessions","POST",form,`resident-checkout:${member.id}:${price.id}`);if(!session.url)throw new Error("CHECKOUT_URL_MISSING");return NextResponse.json({checkoutUrl:session.url,sessionId:session.id,monthlyAmount:3278},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const code=error instanceof Error?error.message:"STRIPE_ERROR";return NextResponse.json({error:code,message:message(code)},{status:502});}
}
