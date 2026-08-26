import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { authenticatedLineProfile } from "@/lib/member-auth";
import { memberPresentation } from "@/lib/member-rank";

type CardRow={id:string;memberCode:string;displayName:string;memberRank:string|null;residentStatus:"UNKNOWN"|"ACTIVE"|"INACTIVE";points:number;currentRank:string|null;rate:number|null;residentPlanActive:number|null};

export async function GET(request:NextRequest){
 const runtime=env as unknown as Record<string,string|undefined>;
 const profile=await authenticatedLineProfile(request);
 let row:CardRow|null=null;
 if(profile)row=await env.DB.prepare(`SELECT m.id,m.member_code AS memberCode,m.display_name AS displayName,m.member_rank AS memberRank,m.resident_status AS residentStatus,m.points_balance AS points,s.current_rank AS currentRank,s.current_rate_percent AS rate,s.resident_plan_active AS residentPlanActive FROM identity_links i JOIN members m ON m.id=i.member_id LEFT JOIN member_rank_states s ON s.member_id=m.id WHERE i.provider='LINE' AND i.provider_user_id=? AND i.revoked_at IS NULL AND m.status='ACTIVE' LIMIT 1`).bind(profile.userId).first<CardRow>();
 else if(request.headers.get("x-compass-preview")==="representative"&&runtime.PREVIEW_MEMBER_CODE)row=await env.DB.prepare(`SELECT m.id,m.member_code AS memberCode,m.display_name AS displayName,m.member_rank AS memberRank,m.resident_status AS residentStatus,m.points_balance AS points,s.current_rank AS currentRank,s.current_rate_percent AS rate,s.resident_plan_active AS residentPlanActive FROM members m LEFT JOIN member_rank_states s ON s.member_id=m.id WHERE m.member_code=? AND m.status='ACTIVE' LIMIT 1`).bind(runtime.PREVIEW_MEMBER_CODE).first<CardRow>();
 else return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 if(!row){const staged=profile?await env.DB.prepare("SELECT id FROM legacy_member_imports WHERE line_user_id=? AND status='UNREGISTERED' LIMIT 1").bind(profile.userId).first():null;return NextResponse.json({error:staged?"REGISTRATION_REQUIRED":"MEMBERSHIP_NOT_LINKED"},{status:staged?422:404})}
 const presentation=memberPresentation(row.currentRank??row.memberRank,0,row.residentStatus,Boolean(row.residentPlanActive));
 return NextResponse.json({memberId:row.id,memberCode:row.memberCode,displayName:row.displayName,points:row.points,rank:row.currentRank??presentation.rank,rankLabel:presentation.rankLabel,membershipType:presentation.membershipType,membershipLabel:presentation.membershipLabel,pointRatePercent:row.rate??presentation.pointRatePercent,residentPlanActive:Boolean(row.residentPlanActive),notices:[]},{headers:{"Cache-Control":"private, no-store","Server-Timing":"card;desc=fast-member-card"}});
}
