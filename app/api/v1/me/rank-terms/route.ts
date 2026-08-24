import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";
import { MEMBER_RANK_TERMS_VERSION } from "@/lib/member-rank";

export async function POST(request:NextRequest){
 const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const body=await request.json().catch(()=>null) as {agreed?:boolean;termsVersion?:string}|null;
 if(body?.agreed!==true||body.termsVersion!==MEMBER_RANK_TERMS_VERSION)return NextResponse.json({error:"INVALID_CONSENT"},{status:400});
 const now=Date.now();
 await env.DB.prepare(`INSERT INTO member_policy_consents (id,member_id,terms_version,consent_type,source,agreed_at,user_agent) VALUES (?,?,'${MEMBER_RANK_TERMS_VERSION}','MEMBERSHIP_AND_POINTS','MEMBER_CARD',?,?) ON CONFLICT(member_id,terms_version,consent_type) DO NOTHING`).bind(crypto.randomUUID(),member.id,now,(request.headers.get("user-agent")??"").slice(0,300)||null).run();
 return NextResponse.json({ok:true,termsVersion:MEMBER_RANK_TERMS_VERSION,agreedAt:now});
}
