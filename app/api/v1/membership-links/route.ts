import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedLineUserId } from "@/lib/member-auth";

export async function POST(request: NextRequest) {
  const lineUserId=await authenticatedLineUserId(request);if(!lineUserId)return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
  const body=await request.json().catch(()=>null) as {memberCode?:string;phone?:string;birthDate?:string}|null;
  const memberCode=(body?.memberCode??"").trim().toUpperCase(),phone=digits(body?.phone??""),birthDate=(body?.birthDate??"").trim();
  if(!/^[A-Z0-9]{10}$/.test(memberCode)||phone.length<8||!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))return NextResponse.json({error:"VERIFICATION_REQUIRED"},{status:400});
  const already=await env.DB.prepare("SELECT 1 FROM identity_links WHERE provider='LINE' AND provider_user_id=? AND revoked_at IS NULL").bind(lineUserId).first();if(already)return NextResponse.json({error:"ALREADY_LINKED"},{status:409});
  const member=await env.DB.prepare(`SELECT id,phone,birth_date AS birthDate FROM members WHERE member_code=? AND status='ACTIVE'`).bind(memberCode).first<{id:string;phone:string|null;birthDate:string|null}>();
  if(!member||digits(member.phone??"")!==phone||member.birthDate!==birthDate)return NextResponse.json({error:"MEMBER_VERIFICATION_FAILED",message:"会員番号・電話番号・生年月日を確認してください"},{status:404});
  const occupied=await env.DB.prepare("SELECT 1 FROM identity_links WHERE member_id=? AND provider='LINE' AND revoked_at IS NULL").bind(member.id).first();if(occupied)return NextResponse.json({error:"MEMBER_ALREADY_LINKED",message:"この会員番号はすでに移行済みです"},{status:409});
  const now=Date.now();await env.DB.batch([env.DB.prepare("INSERT INTO identity_links (id,member_id,provider,provider_user_id,linked_at,revoked_at) VALUES (?,?,'LINE',?,?,NULL)").bind(`line:${lineUserId}`,member.id,lineUserId,now),env.DB.prepare("UPDATE legacy_member_imports SET status='MIGRATED',migrated_member_id=? WHERE line_user_id=?").bind(member.id,lineUserId)]);
  return NextResponse.json({ok:true,memberCode});
}

function digits(value:string){return value.replace(/\D/g,"")}
