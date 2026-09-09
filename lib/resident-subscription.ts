import { env } from "cloudflare:workers";
import { stripeRequest } from "@/lib/stripe";

export const RESIDENT_MONTHLY_AMOUNT_JPY = 3278;
const ACTIVE_STATUSES = new Set(["active", "trialing"]);
type StripePrice = { id:string;active:boolean;currency:string;unit_amount:number|null;recurring?:{interval?:string}|null;product?:string|{id?:string;name?:string} };
type StripeList<T> = { data:T[];has_more:boolean };
export type StripeSubscription = { id:string;customer:string;status:string;cancel_at_period_end?:boolean;current_period_end?:number;items?:{data?:Array<{price?:StripePrice}>};metadata?:Record<string,string> };
function runtime(){return env as unknown as Record<string,string|undefined>}
export function residentSubscriptionActive(status:unknown){return ACTIVE_STATUSES.has(String(status??"").toLowerCase())}
export async function residentPrice(){
  const configured=runtime().RESIDENT_SUBSCRIPTION_PRICE_ID?.trim();
  if(configured){const price=await stripeRequest<StripePrice>(`/prices/${encodeURIComponent(configured)}`);if(!price.active||price.currency!=="jpy"||price.unit_amount!==RESIDENT_MONTHLY_AMOUNT_JPY||price.recurring?.interval!=="month")throw new Error("RESIDENT_PRICE_CONFIGURATION_MISMATCH");return price;}
  const params=new URLSearchParams({active:"true",type:"recurring",limit:"100"});params.append("expand[]","data.product");
  const list=await stripeRequest<StripeList<StripePrice>>(`/prices?${params.toString()}`),matches=list.data.filter(price=>price.currency==="jpy"&&price.unit_amount===RESIDENT_MONTHLY_AMOUNT_JPY&&price.recurring?.interval==="month");
  if(matches.length!==1)throw new Error(matches.length?"RESIDENT_PRICE_AMBIGUOUS":"RESIDENT_PRICE_NOT_FOUND");return matches[0];
}
export async function syncResidentSubscription(subscription:StripeSubscription,eventId:string){
  const customerId=String(subscription.customer??"");let memberId=String(subscription.metadata?.member_id??"");
  if(!memberId&&customerId){const mapped=await env.DB.prepare("SELECT member_id AS memberId FROM stripe_customers WHERE stripe_customer_id=? LIMIT 1").bind(customerId).first<{memberId:string}>();memberId=mapped?.memberId??""}
  if(!memberId||!customerId)return false;
  const priceId=String(subscription.items?.data?.[0]?.price?.id??subscription.metadata?.price_id??""),now=Date.now(),active=residentSubscriptionActive(subscription.status),periodEnd=subscription.current_period_end?subscription.current_period_end*1000:null;
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO stripe_customers (member_id,stripe_customer_id,updated_at) VALUES (?,?,?)`).bind(memberId,customerId,now),
    env.DB.prepare(`INSERT INTO resident_subscriptions (member_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,status,current_period_end,cancel_at_period_end,last_stripe_event_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,stripe_price_id=excluded.stripe_price_id,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,last_stripe_event_id=excluded.last_stripe_event_id,updated_at=excluded.updated_at`).bind(memberId,customerId,subscription.id,priceId,subscription.status,periodEnd,subscription.cancel_at_period_end?1:0,eventId,now),
    env.DB.prepare("UPDATE members SET resident_status=?,resident_checked_at=?,updated_at=? WHERE id=?").bind(active?"ACTIVE":"INACTIVE",now,now,memberId),
    env.DB.prepare(`UPDATE member_rank_states
      SET resident_plan_active=?,
          membership_type=?,
          current_rank=CASE
            WHEN ?=1 AND current_rank IN ('STANDARD','BRONZE','SILVER') THEN 'GOLD'
            ELSE current_rank
          END,
          current_rate_percent=CASE
            WHEN ?=1 AND current_rate_percent<5 THEN 5
            ELSE current_rate_percent
          END
      WHERE member_id=?`).bind(active?1:0,active?"RESIDENT":"GENERAL",active?1:0,active?1:0,memberId),
  ]);return true;
}
export async function subscriptionsForCustomer(customerId:string){const params=new URLSearchParams({customer:customerId,status:"all",limit:"100"});params.append("expand[]","data.items.data.price");return (await stripeRequest<StripeList<StripeSubscription>>(`/subscriptions?${params.toString()}`)).data;}
