import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

async function authorized(request: NextRequest) {
  const configured = (env as unknown as { RECEPTION_API_TOKEN?: string }).RECEPTION_API_TOKEN ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!configured || !supplied) return false;
  const encode = (value:string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [expected, actual] = await Promise.all([encode(configured), encode(supplied)]);
  const left = new Uint8Array(expected), right = new Uint8Array(actual);
  let difference = left.length ^ right.length;
  for (let index=0; index<Math.min(left.length,right.length); index+=1) difference |= left[index]^right[index];
  return difference===0;
}

export async function POST(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  const body = await request.json().catch(()=>null) as {memberCode?:string;memberRank?:string;requestedHours?:number;reservationId?:string}|null;
  const memberCode = body?.memberCode?.trim() ?? "";
  const requestedMemberRank = body?.memberRank === "RESIDENT" ? "RESIDENT" : body?.memberRank === "STANDARD" ? "STANDARD" : "";
  const requestedHours = Number(body?.requestedHours ?? 1);
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(memberCode) || !requestedMemberRank || !Number.isInteger(requestedHours) || requestedHours<1 || requestedHours>10)
    return NextResponse.json({error:"INVALID_CHECK_IN"},{status:400});
  const active = await env.DB.prepare(
    `SELECT s.id FROM studio_sessions s JOIN members m ON m.id=s.member_id
      WHERE m.member_code=? AND s.studio_id='FEBBRAIO' AND s.status='IN_USE' LIMIT 1`,
  ).bind(memberCode).first<{id:string}>();
  if (active) return NextResponse.json({error:"ACTIVE_USAGE_EXISTS",sessionId:active.id},{status:409});
  const now=Date.now(), memberId=`card:${memberCode}`, sessionId=crypto.randomUUID(), scheduledEndsAt=now+requestedHours*3_600_000;
  await env.DB.prepare(
    `INSERT INTO members (id,member_code,display_name,status,source_system,source_customer_id,created_at,updated_at)
     VALUES (?,?,?,'ACTIVE','RECEPTION',?, ?,?)
     ON CONFLICT(member_code) DO UPDATE SET status='ACTIVE',updated_at=excluded.updated_at`,
  ).bind(memberId,memberCode,"FEBBRAIO会員",memberCode,now,now).run();
  const member=await env.DB.prepare("SELECT id, member_rank FROM members WHERE member_code=? LIMIT 1").bind(memberCode).first<{id:string;member_rank:"STANDARD"|"RESIDENT"|null}>();
  if(!member) return NextResponse.json({error:"MEMBER_SAVE_FAILED"},{status:500});
  const memberRank = member.member_rank ?? requestedMemberRank;
  await env.DB.prepare(
    `INSERT INTO studio_sessions (id,reservation_id,member_id,studio_id,checked_in_at,scheduled_ends_at,plan_type,status,payment_status,version,updated_at)
     VALUES (?,?,?,?,?,?,?,'IN_USE','UNPAID',1,?)`,
  ).bind(sessionId,null,member.id,"FEBBRAIO",now,scheduledEndsAt,memberRank,now).run();
  return NextResponse.json({sessionId,status:"IN_USE",checkedInAt:now,scheduledEndsAt,memberRank},{status:201});
}
