import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";

type PointHistoryResult={memberCode:string;month:string;balance:number;entries:unknown[];source:string;syncedAt:string};

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
  await env.DB.prepare("UPDATE members SET points_balance=?,updated_at=? WHERE id=?").bind(balance,Date.now(),member.id).run();
  return NextResponse.json({...body.result,balance},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"POINT_HISTORY_TIMEOUT",message:"ポイント履歴を取得できませんでした。時間をおいて再度お試しください"},{status:504})}
}
