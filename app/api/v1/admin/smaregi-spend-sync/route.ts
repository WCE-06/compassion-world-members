import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
type Row={memberCode?:string;qualifyingSpendExcludingTax?:number;periodStart?:number;periodEnd?:number;sourceRevision?:string};
export async function POST(request:NextRequest){
 const runtime=env as unknown as Record<string,string|undefined>;
 const supplied=request.headers.get("x-compass-migration-key");
 const accepted=[runtime.SMAREGI_SPEND_SYNC_KEY,runtime.MEMBER_MIGRATION_KEY].filter(Boolean);
 if(!supplied||!accepted.includes(supplied))return NextResponse.json({error:"FORBIDDEN"},{status:403});
 const body=await request.json().catch(()=>null) as {rows?:Row[]}|null;
 if(!Array.isArray(body?.rows)||body.rows.length<1||body.rows.length>100)return NextResponse.json({error:"INVALID_BATCH"},{status:400});
 const now=Date.now(),results:{memberCode:string;status:"SYNCED"|"MEMBER_NOT_FOUND"}[]=[];
 for(const row of body.rows){const code=(row.memberCode??"").trim().toUpperCase(),amount=Number(row.qualifyingSpendExcludingTax),start=Number(row.periodStart),end=Number(row.periodEnd),spanDays=(end-start)/86400000;if(!/^[A-Z0-9]{10}$/.test(code)||!Number.isInteger(amount)||amount<0||!Number.isFinite(start)||!Number.isFinite(end)||start>=end||spanDays<360||spanDays>370)return NextResponse.json({error:"INVALID_ROW",memberCode:code||null},{status:400});const member=await env.DB.prepare(`SELECT id FROM members WHERE member_code=? AND status='ACTIVE' LIMIT 1`).bind(code).first<{id:string}>();if(!member){results.push({memberCode:code,status:"MEMBER_NOT_FOUND"});continue}await env.DB.prepare(`INSERT INTO member_spend_snapshots (member_id,source,qualifying_spend_excluding_tax,period_start,period_end,source_revision,synced_at) VALUES (?,'SMAREGI',?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET qualifying_spend_excluding_tax=excluded.qualifying_spend_excluding_tax,period_start=excluded.period_start,period_end=excluded.period_end,source_revision=excluded.source_revision,synced_at=excluded.synced_at`).bind(member.id,amount,start,end,(row.sourceRevision??"").trim().slice(0,120)||null,now).run();results.push({memberCode:code,status:"SYNCED"});}
 return NextResponse.json({ok:true,synced:results.filter(row=>row.status==="SYNCED").length,notFound:results.filter(row=>row.status==="MEMBER_NOT_FOUND").length,results});
}
