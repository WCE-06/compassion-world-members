import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { rankPeriodFor,rankRule,retainedRank } from "@/lib/member-rank";

type Row={memberCode?:string;qualifyingSpendExcludingTax?:number;periodStart?:number;periodEnd?:number;sourceRevision?:string};
type MemberRow={id:string;memberRank:string|null;residentStatus:"UNKNOWN"|"ACTIVE"|"INACTIVE";createdAt:number;cardStartedAt:number|null};
type RankState={currentRank:string;rankPeriodStartedAt:number;rankPeriodEndsAt:number;qualifyingSpend:number;sourceRevision:string|null};

export async function POST(request:NextRequest){
 const runtime=env as unknown as Record<string,string|undefined>,supplied=request.headers.get("x-compass-migration-key"),accepted=[runtime.SMAREGI_SPEND_SYNC_KEY,runtime.MEMBER_MIGRATION_KEY].filter(Boolean);
 if(!supplied||!accepted.includes(supplied))return NextResponse.json({error:"FORBIDDEN"},{status:403});
 const body=await request.json().catch(()=>null) as {rows?:Row[]}|null;
 if(!Array.isArray(body?.rows)||body.rows.length<1||body.rows.length>100)return NextResponse.json({error:"INVALID_BATCH"},{status:400});
 const now=Date.now(),results:{memberCode:string;status:string;rank?:string}[]=[];
 for(const row of body.rows){
  const code=(row.memberCode??"").trim().toUpperCase(),amount=Number(row.qualifyingSpendExcludingTax),start=Number(row.periodStart),end=Number(row.periodEnd),revision=(row.sourceRevision??"").trim().slice(0,120),spanDays=(end-start)/86400000;
  if(!/^[A-Z0-9]{10}$/.test(code)||!Number.isInteger(amount)||amount<0||!Number.isFinite(start)||!Number.isFinite(end)||start>=end||spanDays<360||spanDays>370||!revision)return NextResponse.json({error:"INVALID_ROW",memberCode:code||null},{status:400});
  const member=await env.DB.prepare(`SELECT m.id,m.member_rank AS memberRank,m.resident_status AS residentStatus,m.created_at AS createdAt,(SELECT linked_at FROM identity_links WHERE member_id=m.id AND provider='LINE' AND revoked_at IS NULL ORDER BY linked_at LIMIT 1) AS cardStartedAt FROM members m WHERE m.member_code=? AND m.status='ACTIVE' LIMIT 1`).bind(code).first<MemberRow>();
  if(!member){results.push({memberCode:code,status:"MEMBER_NOT_FOUND"});continue}
  const state=await env.DB.prepare(`SELECT current_rank AS currentRank,rank_period_started_at AS rankPeriodStartedAt,rank_period_ends_at AS rankPeriodEndsAt,qualifying_spend_excluding_tax AS qualifyingSpend,spend_source_revision AS sourceRevision FROM member_rank_states WHERE member_id=?`).bind(member.id).first<RankState>();
  if(state?.sourceRevision===revision){results.push({memberCode:code,status:"UNCHANGED",rank:state.currentRank});continue}
  const resident=member.residentStatus==="ACTIVE"||(member.residentStatus==="UNKNOWN"&&(runtime.LEGACY_RESIDENT_MEMBER_CODES??"").split(",").map(v=>v.trim().toUpperCase()).includes(code));
  const initialStart=member.cardStartedAt??member.createdAt,period=rankPeriodFor(state?.rankPeriodStartedAt??initialStart,now),annualReview=Boolean(state&&now>state.rankPeriodEndsAt),previous=state?.currentRank??member.memberRank;
  const nextRank=retainedRank(previous,amount,resident,annualReview),rule=rankRule(nextRank),eventType=!state?"INITIALIZED":annualReview?"ANNUAL_REVIEW":nextRank!==state.currentRank?"PROMOTED":"SYNCED",decrease=state&&amount<state.qualifyingSpend;
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO member_spend_snapshots (member_id,source,qualifying_spend_excluding_tax,period_start,period_end,source_revision,synced_at) VALUES (?,'SMAREGI',?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET qualifying_spend_excluding_tax=excluded.qualifying_spend_excluding_tax,period_start=excluded.period_start,period_end=excluded.period_end,source_revision=excluded.source_revision,synced_at=excluded.synced_at`).bind(member.id,amount,start,end,revision,now),
   env.DB.prepare(`INSERT INTO member_rank_states (member_id,current_rank,current_rate_percent,rank_period_started_at,rank_period_ends_at,qualifying_spend_excluding_tax,rank_updated_at,next_review_at,membership_type,resident_plan_active,spend_source,spend_source_revision,spend_synced_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'SMAREGI',?,?) ON CONFLICT(member_id) DO UPDATE SET current_rank=excluded.current_rank,current_rate_percent=excluded.current_rate_percent,rank_period_started_at=excluded.rank_period_started_at,rank_period_ends_at=excluded.rank_period_ends_at,qualifying_spend_excluding_tax=excluded.qualifying_spend_excluding_tax,rank_updated_at=excluded.rank_updated_at,next_review_at=excluded.next_review_at,membership_type=excluded.membership_type,resident_plan_active=excluded.resident_plan_active,spend_source='SMAREGI',spend_source_revision=excluded.spend_source_revision,spend_synced_at=excluded.spend_synced_at`).bind(member.id,nextRank,rule.pointRatePercent,period.rankPeriodStartedAt,period.rankPeriodEndsAt,amount,now,period.nextReviewAt,resident?"RESIDENT":"GENERAL",resident?1:0,revision,now),
   env.DB.prepare("UPDATE members SET member_rank=?,updated_at=? WHERE id=?").bind(nextRank,now,member.id),
   env.DB.prepare(`INSERT INTO member_rank_events (id,member_id,event_type,previous_rank,next_rank,qualifying_spend_excluding_tax,source,source_revision,details_json,created_at) VALUES (?,?,?,?,?,?,'SMAREGI',?,?,?)`).bind(crypto.randomUUID(),member.id,eventType,previous??null,nextRank,amount,revision,JSON.stringify({decreaseAudited:Boolean(decrease),periodStart:start,periodEnd:end}),now),
  ]);
  results.push({memberCode:code,status:decrease?"SYNCED_DECREASE_AUDITED":"SYNCED",rank:nextRank});
 }
 return NextResponse.json({ok:true,synced:results.filter(row=>row.status.startsWith("SYNCED")).length,notFound:results.filter(row=>row.status==="MEMBER_NOT_FOUND").length,results});
}
