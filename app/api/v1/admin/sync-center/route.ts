import {env} from "cloudflare:workers";
import {NextRequest,NextResponse} from "next/server";
import {requireAdminSession} from "@/lib/admin-session";

const runtime=()=>env as unknown as Record<string,string|undefined>;

export async function GET(request:NextRequest){
 const actor=await requireAdminSession(request);if(!actor)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const settings=runtime();
 const [members,line,spend]=await Promise.all([
  env.DB.prepare("SELECT COUNT(*) AS count FROM members WHERE status='ACTIVE'").first<{count:number}>(),
  env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN COALESCE(m.line_display_name,'')='' THEN 1 ELSE 0 END) AS missing FROM identity_links i JOIN members m ON m.id=i.member_id WHERE i.provider='LINE' AND i.revoked_at IS NULL").first<{total:number;missing:number}>(),
  env.DB.prepare("SELECT COUNT(*) AS synced FROM member_spend_snapshots").first<{synced:number}>()
 ]);
 let spendJob:null|Record<string,unknown>=null;
 if(settings.SMAREGI_SPEND_RECALC_URL&&settings.SMAREGI_SPEND_SYNC_KEY)try{
  const upstream=await fetch(settings.SMAREGI_SPEND_RECALC_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"loyaltyAnnualSpendSyncStatus",syncKey:settings.SMAREGI_SPEND_SYNC_KEY}),signal:AbortSignal.timeout(3000)});
  const payload=await upstream.json() as {ok?:boolean;result?:Record<string,unknown>};if(upstream.ok&&payload.ok)spendJob=payload.result??null;
 }catch{}
 return NextResponse.json({activeMembers:members?.count??0,lineLinked:line?.total??0,lineNameMissing:line?.missing??0,spendSynced:spend?.synced??0,lineLoginSyncEnabled:true,bulkLineSyncConfigured:Boolean(settings.LINE_CHANNEL_ACCESS_TOKEN),spendRecalcConfigured:Boolean(settings.SMAREGI_SPEND_RECALC_URL),spendJob},{headers:{"Cache-Control":"private, max-age=5, stale-while-revalidate=15"}});
}

export async function POST(request:NextRequest){
 const actor=await requireAdminSession(request);if(!actor)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const body=await request.json().catch(()=>null) as {action?:"LINE_NAMES"|"SPEND_RECALC"}|null,settings=runtime();
 if(body?.action==="LINE_NAMES"){
  const token=settings.LINE_CHANNEL_ACCESS_TOKEN;if(!token)return NextResponse.json({error:"LINE_BULK_SYNC_NOT_CONFIGURED",message:"LINEログイン時の自動同期は有効です。一括同期にはMessaging APIのチャネルアクセストークンが必要です。"},{status:409});
  const rows=await env.DB.prepare("SELECT i.provider_user_id AS userId,m.id AS memberId FROM identity_links i JOIN members m ON m.id=i.member_id WHERE i.provider='LINE' AND i.revoked_at IS NULL AND COALESCE(m.line_display_name,'')='' LIMIT 25").all<{userId:string;memberId:string}>();
  const profiles=await Promise.all(rows.results.map(async row=>{try{const response=await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(row.userId)}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(4000)});if(!response.ok)return null;const profile=await response.json() as {displayName?:string};const displayName=profile.displayName?.trim().slice(0,120);return displayName?{memberId:row.memberId,displayName}:null}catch{return null}}));
  const updates=profiles.filter((profile):profile is {memberId:string;displayName:string}=>Boolean(profile)),now=Date.now(),failed=rows.results.length-updates.length;
  await env.DB.batch([...updates.map(profile=>env.DB.prepare("UPDATE members SET line_display_name=?,updated_at=? WHERE id=?").bind(profile.displayName,now,profile.memberId)),env.DB.prepare("INSERT INTO member_registration_events (id,member_id,event_type,actor,details_json,created_at) VALUES (?,NULL,'LINE_NAMES_BULK_SYNC',?,?,?)").bind(crypto.randomUUID(),actor,JSON.stringify({updated:updates.length,failed,batch:rows.results.length}),now)]);
  return NextResponse.json({ok:true,updated:updates.length,failed,processed:rows.results.length,hasMore:rows.results.length===25});
 }
 if(body?.action==="SPEND_RECALC"){
  if(!settings.SMAREGI_SPEND_RECALC_URL||!settings.SMAREGI_SPEND_SYNC_KEY)return NextResponse.json({error:"SPEND_RECALC_NOT_CONFIGURED",message:"セルフレジ側の全会員集計開始APIを接続してください。"},{status:409});
  try{const response=await fetch(settings.SMAREGI_SPEND_RECALC_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"loyaltyAnnualSpendSync",syncKey:settings.SMAREGI_SPEND_SYNC_KEY,requestId:crypto.randomUUID(),periodDays:365,mode:"ALL_ACTIVE_MEMBERS_ONCE"}),signal:AbortSignal.timeout(5000)});if(!response.ok)return NextResponse.json({error:"SPEND_RECALC_UPSTREAM_FAILED"},{status:502})}catch{return NextResponse.json({error:"SPEND_RECALC_TIMEOUT",message:"集計システムが応答しませんでした。処理状況を再確認してください。"},{status:504})}
  await env.DB.prepare("INSERT INTO member_registration_events (id,member_id,event_type,actor,details_json,created_at) VALUES (?,NULL,'SMAREGI_FULL_SPEND_RECALC_REQUESTED',?,'{}',?)").bind(crypto.randomUUID(),actor,Date.now()).run();return NextResponse.json({ok:true,accepted:true});
 }
 return NextResponse.json({error:"INVALID_ACTION"},{status:400});
}
