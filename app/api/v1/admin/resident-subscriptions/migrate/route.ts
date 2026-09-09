import {env} from "cloudflare:workers";
import {NextRequest,NextResponse} from "next/server";
import {requireAdminSession} from "@/lib/admin-session";
import {residentPrices,StripeSubscription,syncResidentSubscription} from "@/lib/resident-subscription";
import {stripeRequest} from "@/lib/stripe";

type StripeCustomer={id:string;name?:string|null;email?:string|null;phone?:string|null;metadata?:Record<string,string>};
type ExpandedSubscription=Omit<StripeSubscription,"customer">&{customer:string|StripeCustomer};
type StripeList<T>={data:T[];has_more:boolean};
type Member={id:string;memberCode:string;email:string|null;phone:string|null;lineUserId:string|null};
const normalizeEmail=(value:unknown)=>String(value??"").trim().toLowerCase();
const normalizePhone=(value:unknown)=>String(value??"").replace(/\D/g,"").replace(/^81(?=\d{9,10}$)/,"0");
const normalizeCode=(value:unknown)=>{const code=String(value??"").trim().normalize("NFKC").toUpperCase();return /^[A-Z0-9]{10}$/.test(code)?code:""};

async function subscriptions(priceId:string){const result:ExpandedSubscription[]=[];let startingAfter="";do{const params=new URLSearchParams({price:priceId,status:"all",limit:"100"});params.append("expand[]","data.customer");params.append("expand[]","data.items.data.price");if(startingAfter)params.set("starting_after",startingAfter);const page=await stripeRequest<StripeList<ExpandedSubscription>>(`/subscriptions?${params}`);result.push(...page.data);startingAfter=page.has_more&&page.data.length?page.data[page.data.length-1].id:""}while(startingAfter);return result}

function add(index:Map<string,Set<string>>,key:string,memberId:string){if(!key)return;const values=index.get(key)??new Set<string>();values.add(memberId);index.set(key,values)}
function unique(index:Map<string,Set<string>>,key:string){const values=[...(index.get(key)??[])];return values.length===1?values[0]:null}

async function migrate(request:NextRequest,apply:boolean,requestId:string,manualMappings:Record<string,string>={}){
 const actor=await requireAdminSession(request);if(!actor)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 if(apply&&!requestId)return NextResponse.json({error:"REQUEST_ID_REQUIRED"},{status:400});
 const prior=apply?await env.DB.prepare("SELECT id FROM member_registration_events WHERE event_type='RESIDENT_SUBSCRIPTION_BULK_MIGRATION' AND details_json LIKE ? LIMIT 1").bind(`%${requestId}%`).first():null;if(prior)return NextResponse.json({ok:true,idempotent:true,requestId});
 try{
  const prices=await residentPrices();if(!prices.length)throw new Error("RESIDENT_PRICE_NOT_FOUND");const memberRows=(await env.DB.prepare(`SELECT m.id,m.member_code AS memberCode,m.email,m.phone,(SELECT provider_user_id FROM identity_links i WHERE i.member_id=m.id AND i.provider='LINE' AND i.revoked_at IS NULL ORDER BY linked_at DESC LIMIT 1) AS lineUserId FROM members m WHERE m.status='ACTIVE'`).all<Member>()).results;
  const byId=new Map(memberRows.map(row=>[row.id,row])),byCode=new Map<string,Set<string>>(),byEmail=new Map<string,Set<string>>(),byPhone=new Map<string,Set<string>>(),byLine=new Map<string,Set<string>>();for(const row of memberRows){add(byCode,normalizeCode(row.memberCode),row.id);add(byEmail,normalizeEmail(row.email),row.id);add(byPhone,normalizePhone(row.phone),row.id);add(byLine,String(row.lineUserId??""),row.id)}
  const rows=(await Promise.all(prices.map(price=>subscriptions(price.id)))).flat(),results=[] as Array<Record<string,unknown>>;let matched=0,skipped=0;
  for(const subscription of rows){if(!["active","trialing"].includes(String(subscription.status).toLowerCase()))continue;const customer=typeof subscription.customer==="string"?{id:subscription.customer}:subscription.customer,metadata={...(customer.metadata??{}),...(subscription.metadata??{})},signals=new Map<string,string>();const memberId=String(metadata.member_id??"");if(byId.has(memberId))signals.set("memberId",memberId);const code=normalizeCode(metadata.member_code);if(code){const value=unique(byCode,code);if(value)signals.set("memberCode",value)}const line=String(metadata.line_user_id??metadata.lineUserId??"");if(line){const value=unique(byLine,line);if(value)signals.set("line",value)}const email=normalizeEmail(customer.email);if(email){const value=unique(byEmail,email);if(value)signals.set("email",value)}const phone=normalizePhone(customer.phone);if(phone){const value=unique(byPhone,phone);if(value)signals.set("phone",value)}const candidates=[...new Set(signals.values())];let resolved=candidates.length===1?byId.get(candidates[0]):null,reason=candidates.length>1?"CONFLICTING_IDENTIFIERS":resolved?"MATCHED":"NO_UNIQUE_MATCH";const manualCode=normalizeCode(manualMappings[subscription.id]);if(manualCode){const manualId=unique(byCode,manualCode),manualMember=manualId?byId.get(manualId):null;if(!manualMember)return NextResponse.json({error:"MANUAL_MEMBER_NOT_FOUND",subscriptionId:subscription.id,memberCode:manualCode},{status:400});resolved=manualMember;reason="MANUAL_MATCH";signals.clear();signals.set("staff",manualMember.id)}if(resolved){matched++;if(apply)await syncResidentSubscription({...subscription,customer:customer.id,metadata:{...(subscription.metadata??{}),member_id:resolved.id,member_code:resolved.memberCode}},`migration:${requestId}:${subscription.id}`)}else skipped++;results.push({subscriptionId:subscription.id,customerId:`${customer.id.slice(0,7)}…`,customerName:String(customer.name??"").trim(),customerEmail:email?email.replace(/^(.{1,2}).*(@.*)$/,"$1***$2"):"",status:subscription.status,result:reason,memberCode:resolved?.memberCode??null,matchedBy:resolved?[...signals.keys()]:[]});}
  const priceIds=prices.map(price=>price.id);if(apply)await env.DB.prepare("INSERT INTO member_registration_events (id,member_id,event_type,actor,details_json,created_at) VALUES (?,NULL,'RESIDENT_SUBSCRIPTION_BULK_MIGRATION',?,?,?)").bind(crypto.randomUUID(),actor,JSON.stringify({requestId,priceIds,matched,skipped,total:results.length}),Date.now()).run();
  return NextResponse.json({ok:true,dryRun:!apply,priceIds,total:results.length,matched,skipped,results},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const message=error instanceof Error?error.message:"MIGRATION_FAILED";return NextResponse.json({error:"RESIDENT_SUBSCRIPTION_MIGRATION_FAILED",message},{status:502})}
}

export async function GET(request:NextRequest){return migrate(request,false,"")}
export async function POST(request:NextRequest){const body=await request.json().catch(()=>({})) as {apply?:boolean;requestId?:string;manualMappings?:Record<string,string>};return migrate(request,body.apply===true,String(body.requestId??""),body.manualMappings??{})}
