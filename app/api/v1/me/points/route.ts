import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";

type PointEntry={id:string;occurredAt:string;kind:string;grantedPoint:number;usedPoint:number;delta:number;balanceAfter:number|null;amount:number;cancelled:boolean;label?:string};
type PointHistoryResult={memberCode:string;month:string;balance:number;entries:PointEntry[];source:string;syncedAt:string};

export async function GET(request:NextRequest){
 const member=await authenticatedMember(request);
 if(!member)return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const month=(request.nextUrl.searchParams.get("month")??"").trim();
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return NextResponse.json({error:"INVALID_MONTH"},{status:400});
 const runtime=env as unknown as Record<string,string|undefined>,url=runtime.SMAREGI_SPEND_RECALC_URL,key=runtime.SMAREGI_SPEND_SYNC_KEY;
 if(!url||!key)return NextResponse.json({error:"POINT_HISTORY_NOT_CONFIGURED",message:"ポイント履歴の接続設定を確認しています"},{status:503});
 try{
  const upstream=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"memberPointHistory",syncKey:key,memberCode:member.memberCode,month}),signal:AbortSignal.timeout(20_000)}),body=await upstream.json() as {ok?:boolean;result?:PointHistoryResult;error?:string};
  if(!upstream.ok||body.ok===false||!body.result)return NextResponse.json({error:body.error??"POINT_HISTORY_UPSTREAM_FAILED"},{status:502});
  if(body.result.memberCode!==member.memberCode)return NextResponse.json({error:"POINT_HISTORY_MEMBER_MISMATCH"},{status:409});
  const balance=Math.max(0,Math.trunc(Number(body.result.balance)||0));
  const [year,monthNumber]=month.split("-").map(Number),nextMonth=monthNumber===12?`${year+1}-01`:`${year}-${String(monthNumber+1).padStart(2,"0")}`,monthStartedAt=Date.parse(`${month}-01T00:00:00+09:00`),nextMonthStartedAt=Date.parse(`${nextMonth}-01T00:00:00+09:00`);
  const visitRows=await env.DB.prepare(`SELECT id,occurred_at AS occurredAt,metadata_json AS metadataJson FROM member_notifications
    WHERE member_id=? AND event_type='ENTRY_THANK_YOU' AND occurred_at>=? AND occurred_at<? ORDER BY occurred_at DESC`)
    .bind(member.id,monthStartedAt,nextMonthStartedAt).all<{id:string;occurredAt:number;metadataJson:string}>();
  const upstreamEntries=(body.result.entries??[]).map(item=>({...item})),visitEntries:PointEntry[]=[];
  for(const row of visitRows.results as {id:string;occurredAt:number;metadataJson:string}[]){try{const metadata=JSON.parse(row.metadataJson||"{}") as {pointGranted?:boolean;grantedPoint?:number};const points=Math.max(0,Math.trunc(Number(metadata.grantedPoint)||0));if(!metadata.pointGranted||!points)continue;const matched=upstreamEntries.filter(item=>item.amount===0&&item.delta===points&&Math.abs(Date.parse(item.occurredAt)-row.occurredAt)<=15*60*1000).sort((a,b)=>Math.abs(Date.parse(a.occurredAt)-row.occurredAt)-Math.abs(Date.parse(b.occurredAt)-row.occurredAt))[0];if(matched){matched.kind="VISIT";matched.label="入館ポイント";continue}visitEntries.push({id:`visit:${row.id}`,occurredAt:new Date(row.occurredAt).toISOString(),kind:"VISIT",grantedPoint:points,usedPoint:0,delta:points,balanceAfter:null,amount:0,cancelled:false,label:"入館ポイント"})}catch{/* 不正な付加情報だけを無視する */}}
  const entries=[...upstreamEntries,...visitEntries].filter((item,index,all)=>all.findIndex(candidate=>candidate.id===item.id)===index).sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
  const now=Date.now(),recentPurchaseEntries=entries.filter(item=>item.kind!=="VISIT"&&!item.cancelled&&item.amount>0&&item.grantedPoint>0&&now-Date.parse(item.occurredAt)>=0&&now-Date.parse(item.occurredAt)<=2*60*60_000);
  const statements=[env.DB.prepare("UPDATE members SET points_balance=?,updated_at=? WHERE id=?").bind(balance,now,member.id)];
  for(const item of recentPurchaseEntries){const eventId=`SMAREGI_PURCHASE_THANK_YOU:${item.id}`;statements.push(env.DB.prepare(`INSERT OR IGNORE INTO member_notifications(id,event_id,member_id,event_type,category,title,body,sender,channel,delivery_status,metadata_json,occurred_at,created_at,updated_at) VALUES(?,?,?,'PURCHASE_THANK_YOU','POINT','ご利用ありがとうございます',?,'COMPASSION WORLD','CARD','SAVED',?,?,?,?)`).bind(`notice_purchase_${crypto.randomUUID()}`,eventId,member.id,`今回のお会計で${item.grantedPoint}ポイントが付与されました。\n現在の保有ポイントは${balance.toLocaleString("ja-JP")}ポイントです。\n\nまたのご利用を心よりお待ちしております。`,JSON.stringify({pointHistoryId:item.id,grantedPoint:item.grantedPoint,amount:item.amount,balance}),Date.parse(item.occurredAt),now,now))}
  await env.DB.batch(statements);
  return NextResponse.json({...body.result,balance,entries},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"POINT_HISTORY_TIMEOUT",message:"ポイント履歴を取得できませんでした。時間をおいて再度お試しください"},{status:504})}
}
