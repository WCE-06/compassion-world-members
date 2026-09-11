import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import {requireAdminSession} from "@/lib/admin-session";
import {reconcileAllResidentSubscriptions} from "@/lib/resident-subscription";

function admin(request:NextRequest){const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase(),allowed=((env as unknown as Record<string,string|undefined>).ADMIN_EMAILS??"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);return email&&allowed.includes(email)?email:null}
function jstDayRange(){const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),start=Date.parse(`${day}T00:00:00+09:00`);return{day,start,end:start+86400000}}
type CountRow={count?:number;amount?:number};
type SalesSummary={available:boolean;amount:number;stores:{name:string;amount:number}[];error?:string};

async function salesSummary(runtime:Record<string,string|undefined>,start:number,end:number):Promise<SalesSummary>{
 const dedicated=Boolean(runtime.SMAREGI_SALES_SUMMARY_URL&&runtime.SMAREGI_SALES_SUMMARY_KEY);
 const url=runtime.SMAREGI_SALES_SUMMARY_URL??runtime.SMAREGI_SPEND_RECALC_URL,key=runtime.SMAREGI_SALES_SUMMARY_KEY??runtime.SMAREGI_SPEND_SYNC_KEY;
 if(!url||!key)return{available:false,amount:0,stores:[]};
 try{
  const target=new URL(url),from=new Date(start).toISOString(),to=new Date(end).toISOString();
  if(dedicated){target.searchParams.set("from",from);target.searchParams.set("to",to);target.searchParams.set("scope","ALL_STORES")}
  const response=await fetch(target,dedicated?{headers:{Authorization:`Bearer ${key}`,"X-API-Key":key},signal:AbortSignal.timeout(12000)}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"smaregiSalesSummary",syncKey:key,from,to,scope:"ALL_STORES"}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`HTTP_${response.status}`);
  const body=await response.json() as Record<string,unknown>;
  if(body.ok===false)throw new Error(String(body.error??"SALES_SUMMARY_FAILED"));
  const data=(body.result&&typeof body.result==="object"?body.result:body.data&&typeof body.data==="object"?body.data:body) as Record<string,unknown>,rawStores=Array.isArray(data.stores)?data.stores:[];
  const stores=rawStores.map(value=>{const row=value as Record<string,unknown>;return{name:String(row.storeName??row.name??row.storeId??"店舗"),amount:Number(row.amount??row.sales??row.total??0)}}).filter(row=>Number.isFinite(row.amount));
  const amount=Number(data.amount??data.sales??data.totalSales??data.total??stores.reduce((sum,row)=>sum+row.amount,0));
  return{available:Number.isFinite(amount),amount:Number.isFinite(amount)?amount:0,stores};
 }catch(error){console.error("all-store sales summary failed",error);return{available:false,amount:0,stores:[],error:"SALES_SUMMARY_UNAVAILABLE"}}
}

export async function GET(request:NextRequest){
 if(!(admin(request)??await requireAdminSession(request)))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 try{
  const now=Date.now(),since30=now-30*86400000,since365=now-365*86400000,{day,start,end}=jstDayRange(),runtime=env as unknown as Record<string,string|undefined>;
  const residentWatch=await reconcileAllResidentSubscriptions(5,72*60*60*1000).catch(error=>{console.error("resident background watch failed",error);return[]});
  const [members,residents,ranks,orders,sessions,unpaid,stripe,failures,tasks,communications,todayOrders,todayStudio,todayMembers,activeStudio,urgentTasks,posMissing,inventory,latestWebhook,staleResidents,auditEvents,staleResidentRows,posMissingRows,residentProblems,allStoreSales]=await Promise.all([
   env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN created_at>=? THEN 1 ELSE 0 END) AS new30,SUM(CASE WHEN status='INACTIVE' THEN 1 ELSE 0 END) AS inactive FROM members").bind(since30).first(),
   env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN resident_plan_active=1 THEN 1 ELSE 0 END) AS active FROM member_rank_states").first(),
   env.DB.prepare("SELECT current_rank AS rank,COUNT(*) AS count FROM member_rank_states GROUP BY current_rank ORDER BY count DESC").all(),
   env.DB.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(total_including_tax),0) AS sales365 FROM orders WHERE status IN ('PAID','ACCEPTED','COOKING','READY','PICKED_UP') AND created_at>=?").bind(since365).first(),
   env.DB.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(total_including_tax),0) AS sales365 FROM studio_sessions WHERE payment_status='PAID' AND updated_at>=?").bind(since365).first(),
   env.DB.prepare("SELECT COUNT(*) AS count FROM studio_sessions WHERE payment_status='UNPAID' AND status IN ('IN_USE','COMPLETED')").first(),
   env.DB.prepare("SELECT COUNT(*) AS customers FROM stripe_customers WHERE reusable_consent_at IS NOT NULL").first(),
   env.DB.prepare("SELECT COUNT(*) AS count FROM stripe_webhook_events WHERE status='FAILED'").first(),
   env.DB.prepare("SELECT status,COUNT(*) AS count FROM operations_tasks GROUP BY status").all(),
   env.DB.prepare("SELECT (SELECT COUNT(*) FROM coupons WHERE status='ACTIVE') AS activeCoupons,(SELECT COUNT(*) FROM surveys WHERE status='ACTIVE') AS activeSurveys,(SELECT COUNT(*) FROM message_campaigns WHERE status IN ('DRAFT','SCHEDULED','SENDING')) AS pendingCampaigns,(SELECT COUNT(*) FROM automation_rules WHERE enabled=1) AS activeAutomations").first(),
   env.DB.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN status IN ('PAID','ACCEPTED','COOKING','READY','PICKED_UP') THEN total_including_tax ELSE 0 END),0) AS amount FROM orders WHERE created_at>=? AND created_at<?").bind(start,end).first<CountRow>(),
   env.DB.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN payment_status='PAID' THEN total_including_tax ELSE 0 END),0) AS amount FROM studio_sessions WHERE updated_at>=? AND updated_at<?").bind(start,end).first<CountRow>(),
   env.DB.prepare("SELECT COUNT(*) AS count FROM members WHERE created_at>=? AND created_at<?").bind(start,end).first<CountRow>(),
   env.DB.prepare("SELECT COUNT(*) AS count FROM studio_sessions WHERE status='IN_USE'").first<CountRow>(),
   env.DB.prepare("SELECT COUNT(*) AS count FROM operations_tasks WHERE status NOT IN ('DONE','CANCELLED') AND (priority='URGENT' OR due_at<?)").bind(now).first<CountRow>(),
   env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('PAID','ACCEPTED','COOKING','READY','PICKED_UP') AND smaregi_transaction_id IS NULL").first<CountRow>(),
   env.DB.prepare("SELECT COUNT(*) AS count,SUM(CASE WHEN sold_out=1 THEN 1 ELSE 0 END) AS soldOut,SUM(CASE WHEN sale_ends_at IS NOT NULL AND sale_ends_at BETWEEN ? AND ? THEN 1 ELSE 0 END) AS expiring FROM catalog_overrides").bind(now,now+7*86400000).first(),
   env.DB.prepare("SELECT status,created_at AS createdAt,processed_at AS processedAt FROM stripe_webhook_events ORDER BY created_at DESC LIMIT 1").first(),
   env.DB.prepare("SELECT COUNT(*) AS count FROM resident_subscriptions WHERE status IN ('active','trialing') AND updated_at<?").bind(now-7*86400000).first<CountRow>(),
   env.DB.prepare(`SELECT e.event_type AS eventType,e.actor,e.created_at AS createdAt,m.member_code AS memberCode FROM member_registration_events e LEFT JOIN members m ON m.id=e.member_id WHERE e.actor IS NOT NULL AND e.actor<>'' ORDER BY e.created_at DESC LIMIT 20`).all(),
   env.DB.prepare("SELECT m.member_code AS memberCode,m.display_name AS memberName,r.status,r.current_period_end AS currentPeriodEnd,r.updated_at AS updatedAt FROM resident_subscriptions r JOIN members m ON m.id=r.member_id WHERE r.status IN ('active','trialing') AND r.updated_at<? ORDER BY r.updated_at ASC LIMIT 20").bind(now-7*86400000).all(),
   env.DB.prepare("SELECT o.order_number AS orderNumber,m.member_code AS memberCode,m.display_name AS memberName,o.total_including_tax AS amount,o.status,o.created_at AS createdAt FROM orders o JOIN members m ON m.id=o.member_id WHERE o.status IN ('PAID','ACCEPTED','COOKING','READY','PICKED_UP') AND o.smaregi_transaction_id IS NULL ORDER BY o.created_at ASC LIMIT 30").all(),
   env.DB.prepare("SELECT m.member_code AS memberCode,m.display_name AS memberName,r.status,r.current_period_end AS currentPeriodEnd,r.updated_at AS updatedAt FROM resident_subscriptions r JOIN members m ON m.id=r.member_id WHERE r.status IN ('past_due','unpaid','incomplete','incomplete_expired','paused') ORDER BY r.updated_at DESC LIMIT 20").all(),
   salesSummary(runtime,start,end)
  ]);
  const snsApiConfigured=Boolean(runtime.SNS_CONTROL_API_URL&&runtime.SNS_CONTROL_API_KEY),snsUrl=runtime.SNS_CONTROL_URL??"https://wce-06.github.io/compassion-world-sns-control/",integrations={smaregiProducts:Boolean(runtime.SMAREGI_PRODUCT_MASTER_URL||runtime.SMAREGI_PRODUCT_CREATE_URL||runtime.SELF_REGISTER_CATALOG_URL),smaregiInventory:Boolean((runtime.SMAREGI_INVENTORY_URL??runtime.SMAREGI_SPEND_RECALC_URL)&&(runtime.SMAREGI_INVENTORY_KEY??runtime.SMAREGI_SPEND_SYNC_KEY)),smaregiSales:Boolean((runtime.SMAREGI_SALES_SUMMARY_URL&&runtime.SMAREGI_SALES_SUMMARY_KEY)||(runtime.SMAREGI_SPEND_RECALC_URL&&runtime.SMAREGI_SPEND_SYNC_KEY)),facility:Boolean(runtime.COMMON_FACILITY_GAS_URL&&(runtime.FACILITY_STAFF_API_TOKEN||runtime.FACILITY_API_TOKEN)),stripe:Boolean(runtime.STRIPE_SECRET_KEY&&runtime.STRIPE_WEBHOOK_SECRET),kitchen:Boolean(runtime.KITCHEN_API_TOKEN),line:Boolean(runtime.LINE_CHANNEL_ACCESS_TOKEN),sns:Boolean(snsUrl),snsUrl};
  const alerts=[Number(unpaid?.count??0)>0&&{id:"unpaid",kind:"PAYMENT",level:"warning",label:`利用済み・未精算が ${Number(unpaid?.count??0)}件あります`,instruction:"統合取引台帳で対象の利用と支払い状態を確認してください。",target:"finance"},Number(failures?.count??0)>0&&{id:"stripe-failures",kind:"STRIPE",level:"danger",label:`Stripe Webhookの再処理が必要な記録が ${Number(failures?.count??0)}件あります`,instruction:"決済エラーの内容を確認してから再処理してください。",target:"settings"},residentProblems.results.length>0&&{id:"resident-payment-problem",kind:"STRIPE",level:"danger",label:`住民契約に支払い・契約上の問題が ${residentProblems.results.length}件あります`,instruction:"Stripeから実際の支払い失敗または契約停止状態が返っています。対象会員の契約を確認してください。",target:"residents",records:residentProblems.results},Number(staleResidents?.count??0)>0&&{id:"resident-review",kind:"STRIPE",level:"warning",label:`住民契約を7日以上確認できていない会員が ${Number(staleResidents?.count??0)}件あります`,instruction:"72時間経過後の自動再照合でも更新できない状態が続いています。通信状態とStripe契約を確認してください。",target:"residents",records:staleResidentRows.results},Number(urgentTasks?.count??0)>0&&{id:"urgent-tasks",kind:"TASK",level:"danger",label:`期限超過・緊急タスクが ${Number(urgentTasks?.count??0)}件あります`,instruction:"スタッフToDoを開き、担当と期限を確認してください。",target:"tasks"},Number(posMissing?.count??0)>0&&{id:"pos-missing",kind:"POS",level:"warning",label:`スマレジ取引ID未反映が ${Number(posMissing?.count??0)}件あります`,instruction:"下記注文は決済済み状態ですが取引IDが未登録です。二重会計を避け、スマレジの取引と照合してください。",target:"finance",records:posMissingRows.results},!integrations.facility&&{id:"facility",kind:"FACILITY",level:"info",label:"スタジオ全予約APIは接続設定待ちです",instruction:"設定・同期で接続状態を確認してください。",target:"settings"},!integrations.smaregiInventory&&{id:"inventory",kind:"INVENTORY",level:"info",label:"スマレジ在庫APIは接続設定待ちです",instruction:"商品・在庫確認で接続状態を確認してください。",target:"inventory"}].filter(Boolean);
  return NextResponse.json({generatedAt:now,today:{date:day,orders:Number(todayOrders?.count??0),orderSales:Number(todayOrders?.amount??0),studioTransactions:Number(todayStudio?.count??0),studioSales:Number(todayStudio?.amount??0),newMembers:Number(todayMembers?.count??0),activeStudio:Number(activeStudio?.count??0),allStoreSales},residentWatch:{checked:residentWatch.length,failures:residentWatch.filter(row=>!row.updated&&row.status!=="UNCHANGED").length},alerts,auditEvents:auditEvents.results,members,residents,ranks:ranks.results,finance:{orders,sessions,unpaid,stripe,failures,posMissing,allStoreSales},inventory,latestWebhook,tasks:tasks.results,communications,integrations:{...integrations,snsUrl,snsApiConfigured,inventoryConfigured:integrations.smaregiInventory,salesConfigured:integrations.smaregiSales,facilityStaffReservationsConfigured:integrations.facility}},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("admin operations failed",error);return NextResponse.json({error:"OPERATIONS_QUERY_FAILED"},{status:500})}
}
