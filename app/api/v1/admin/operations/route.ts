import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import {requireAdminSession} from "@/lib/admin-session";

function admin(request:NextRequest){const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase(),allowed=((env as unknown as Record<string,string|undefined>).ADMIN_EMAILS??"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);return email&&allowed.includes(email)?email:null}
function jstDayRange(){const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),start=Date.parse(`${day}T00:00:00+09:00`);return{day,start,end:start+86400000}}
type CountRow={count?:number;amount?:number};

export async function GET(request:NextRequest){
 if(!(admin(request)??await requireAdminSession(request)))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 try{
  const now=Date.now(),since30=now-30*86400000,since365=now-365*86400000,{day,start,end}=jstDayRange(),runtime=env as unknown as Record<string,string|undefined>;
  const [members,residents,ranks,orders,sessions,unpaid,stripe,failures,tasks,communications,todayOrders,todayStudio,todayMembers,activeStudio,urgentTasks,posMissing,inventory,latestWebhook]=await Promise.all([
   env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN created_at>=? THEN 1 ELSE 0 END) AS new30,SUM(CASE WHEN status='INACTIVE' THEN 1 ELSE 0 END) AS inactive FROM members").bind(since30).first(),
   env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN resident_plan_active=1 THEN 1 ELSE 0 END) AS active FROM member_rank_states").first(),
   env.DB.prepare("SELECT current_rank AS rank,COUNT(*) AS count FROM member_rank_states GROUP BY current_rank ORDER BY count DESC").all(),
   env.DB.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(total_including_tax),0) AS sales365 FROM orders WHERE status IN ('PAID','ACCEPTED','COOKING','READY','PICKED_UP') AND created_at>=?").bind(since365).first(),
   env.DB.prepare("SELECT COUNT(*) AS count,COALESCE(SUM(total_including_tax),0) AS sales365 FROM studio_sessions WHERE payment_status='PAID' AND updated_at>=?").bind(since365).first(),
   env.DB.prepare("SELECT (SELECT COUNT(*) FROM orders WHERE status IN ('PENDING_PAYMENT','WAITING_STORE_PAYMENT','PAYMENT_PROCESSING'))+(SELECT COUNT(*) FROM studio_sessions WHERE payment_status='UNPAID' AND status<>'CANCELLED') AS count").first(),
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
   env.DB.prepare("SELECT status,created_at AS createdAt,processed_at AS processedAt FROM stripe_webhook_events ORDER BY created_at DESC LIMIT 1").first()
  ]);
  const integrations={smaregiProducts:Boolean(runtime.SMAREGI_PRODUCT_MASTER_URL||runtime.SMAREGI_PRODUCT_CREATE_URL),smaregiInventory:Boolean(runtime.SMAREGI_INVENTORY_URL&&runtime.SMAREGI_INVENTORY_KEY),smaregiSales:Boolean(runtime.SMAREGI_SALES_SUMMARY_URL&&runtime.SMAREGI_SALES_SUMMARY_KEY),facility:Boolean(runtime.COMMON_FACILITY_GAS_URL&&(runtime.FACILITY_STAFF_API_TOKEN||runtime.FACILITY_API_TOKEN)),stripe:Boolean(runtime.STRIPE_SECRET_KEY&&runtime.STRIPE_WEBHOOK_SECRET),kitchen:Boolean(runtime.KITCHEN_API_TOKEN),line:Boolean(runtime.LINE_CHANNEL_ACCESS_TOKEN),sns:Boolean(runtime.SNS_CONTROL_API_URL&&runtime.SNS_CONTROL_API_KEY),snsUrl:runtime.SNS_CONTROL_URL??"https://wce-06.github.io/compassion-world-sns-control/"};
  const alerts=[Number(unpaid?.count??0)>0&&{kind:"PAYMENT",level:"warning",label:`未精算・決済待ちが ${Number(unpaid?.count??0)}件あります`},Number(failures?.count??0)>0&&{kind:"STRIPE",level:"danger",label:`Stripe処理失敗が ${Number(failures?.count??0)}件あります`},Number(urgentTasks?.count??0)>0&&{kind:"TASK",level:"danger",label:`期限超過・緊急タスクが ${Number(urgentTasks?.count??0)}件あります`},Number(posMissing?.count??0)>0&&{kind:"POS",level:"warning",label:`スマレジ取引ID未反映が ${Number(posMissing?.count??0)}件あります`},!integrations.facility&&{kind:"FACILITY",level:"info",label:"スタジオ全予約APIは接続設定待ちです"},!integrations.smaregiInventory&&{kind:"INVENTORY",level:"info",label:"スマレジ在庫APIは接続設定待ちです"}].filter(Boolean);
  return NextResponse.json({generatedAt:now,today:{date:day,orders:Number(todayOrders?.count??0),orderSales:Number(todayOrders?.amount??0),studioTransactions:Number(todayStudio?.count??0),studioSales:Number(todayStudio?.amount??0),newMembers:Number(todayMembers?.count??0),activeStudio:Number(activeStudio?.count??0)},alerts,members,residents,ranks:ranks.results,finance:{orders,sessions,unpaid,stripe,failures,posMissing},inventory,latestWebhook,tasks:tasks.results,communications,integrations:{...integrations,snsUrl:integrations.snsUrl,snsApiConfigured:integrations.sns,inventoryConfigured:integrations.smaregiInventory,salesConfigured:integrations.smaregiSales,facilityStaffReservationsConfigured:integrations.facility}},{headers:{"Cache-Control":"private, max-age=30, stale-while-revalidate=60"}});
 }catch(error){console.error("admin operations failed",error);return NextResponse.json({error:"OPERATIONS_QUERY_FAILED"},{status:500})}
}
