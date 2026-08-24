import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { memberPresentation,rankPeriodFor } from "@/lib/member-rank";
import { requirePosToken } from "@/lib/pos-api";

type BenefitRow={id:string;memberCode:string;memberRank:string|null;residentStatus:"UNKNOWN"|"ACTIVE"|"INACTIVE";createdAt:number;cardStartedAt:number|null;qualifyingSpend:number|null;syncedAt:number|null;currentRank:string|null;currentRatePercent:number|null;rankPeriodStartedAt:number|null;rankPeriodEndsAt:number|null;nextReviewAt:number|null;membershipType:string|null;residentPlanActive:number|null;spendSource:string|null};

export async function GET(request:NextRequest){
 if(!await requirePosToken(request))return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});
 const memberCode=(request.nextUrl.searchParams.get("memberCode")??"").trim().toUpperCase();
 if(!/^[A-Z0-9]{10}$/.test(memberCode))return NextResponse.json({ok:false,error:"INVALID_MEMBER_CODE"},{status:400});
 const row=await env.DB.prepare(`SELECT m.id,m.member_code AS memberCode,m.member_rank AS memberRank,m.resident_status AS residentStatus,m.created_at AS createdAt,(SELECT linked_at FROM identity_links WHERE member_id=m.id AND provider='LINE' AND revoked_at IS NULL ORDER BY linked_at LIMIT 1) AS cardStartedAt,s.qualifying_spend_excluding_tax AS qualifyingSpend,s.synced_at AS syncedAt,r.current_rank AS currentRank,r.current_rate_percent AS currentRatePercent,r.rank_period_started_at AS rankPeriodStartedAt,r.rank_period_ends_at AS rankPeriodEndsAt,r.next_review_at AS nextReviewAt,r.membership_type AS membershipType,r.resident_plan_active AS residentPlanActive,r.spend_source AS spendSource FROM members m LEFT JOIN member_spend_snapshots s ON s.member_id=m.id LEFT JOIN member_rank_states r ON r.member_id=m.id WHERE m.member_code=? AND m.status='ACTIVE' LIMIT 1`).bind(memberCode).first<BenefitRow>();
 if(!row)return NextResponse.json({ok:false,error:"MEMBER_NOT_FOUND"},{status:404});
 const runtime=env as unknown as Record<string,string|undefined>,legacy=row.residentStatus==="UNKNOWN"&&(runtime.LEGACY_RESIDENT_MEMBER_CODES??"").split(",").map(v=>v.trim().toUpperCase()).includes(memberCode),presentation=memberPresentation(row.currentRank??row.memberRank,row.qualifyingSpend??0,row.residentStatus,legacy),period=row.rankPeriodStartedAt&&row.rankPeriodEndsAt?{rankPeriodStartedAt:row.rankPeriodStartedAt,rankPeriodEndsAt:row.rankPeriodEndsAt,nextReviewAt:row.nextReviewAt??row.rankPeriodEndsAt+1}:rankPeriodFor(row.cardStartedAt??row.createdAt);
 const rate=Number.isInteger(row.currentRatePercent)?row.currentRatePercent!:presentation.pointRatePercent;
 return NextResponse.json({ok:true,memberCode,rank:row.currentRank??presentation.rank,rankLabel:presentation.rankLabel,pointRatePercent:rate,pointGivingUnitPrice:100,pointGivingUnit:rate,qualifyingSpend:row.qualifyingSpend??0,qualifyingSpendSource:row.syncedAt?"SMAREGI":"NOT_SYNCED",qualifyingSpendUpdatedAt:row.syncedAt??null,...period,membershipType:row.membershipType??presentation.membershipType,residentPlanActive:Boolean(row.residentPlanActive)||presentation.membershipType==="RESIDENT",amountToNextRank:presentation.amountToNextRank,nextRank:presentation.nextRank},{headers:{"Cache-Control":"no-store"}});
}
