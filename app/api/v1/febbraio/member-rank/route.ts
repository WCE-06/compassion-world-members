import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

async function authorized(request: NextRequest) {
  const configured = (env as unknown as { RECEPTION_API_TOKEN?: string }).RECEPTION_API_TOKEN ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!configured || !supplied) return false;
  const encode = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [expected, actual] = await Promise.all([encode(configured), encode(supplied)]);
  const left = new Uint8Array(expected), right = new Uint8Array(actual);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function GET(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const memberCode = request.nextUrl.searchParams.get("memberCode")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9]{10}$/.test(memberCode)) {
    return NextResponse.json({ error: "INVALID_MEMBER_CODE" }, { status: 400 });
  }
  const member = await env.DB.prepare(
    `SELECT m.id,m.member_code,m.display_name,m.member_rank,m.resident_status,m.status,
      r.membership_type,r.resident_plan_active
      FROM members m LEFT JOIN member_rank_states r ON r.member_id=m.id
      WHERE m.member_code=? LIMIT 1`,
  ).bind(memberCode).first<{
    id: string;
    member_code: string;
    display_name: string;
    member_rank: string | null;
    resident_status: "UNKNOWN" | "ACTIVE" | "INACTIVE";
    status: "ACTIVE" | "INACTIVE";
    membership_type: "GENERAL" | "RESIDENT" | null;
    resident_plan_active: number | null;
  }>();
  if (!member) return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  if (member.status !== "ACTIVE") return NextResponse.json({ error: "MEMBER_INACTIVE" }, { status: 403 });
  const resident = member.resident_status === "ACTIVE" || member.membership_type === "RESIDENT" || Boolean(member.resident_plan_active) || member.member_rank === "RESIDENT";
  const memberRank = resident ? "RESIDENT" : "STANDARD";
  return NextResponse.json({
    memberId: member.id,
    memberCode: member.member_code,
    name: member.display_name || "会員",
    status: member.status,
    memberRank,
    planCode: memberRank,
    planName: resident ? "住民限定プラン" : "通常プラン",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { memberCode?: string; memberRank?: string } | null;
  const memberCode = body?.memberCode?.trim() ?? "";
  const memberRank = body?.memberRank === "RESIDENT" ? "RESIDENT" : body?.memberRank === "STANDARD" ? "STANDARD" : "";
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(memberCode) || !memberRank) {
    return NextResponse.json({ error: "INVALID_MEMBER_RANK" }, { status: 400 });
  }

  const now = Date.now();
  const member = await env.DB.prepare("SELECT id FROM members WHERE member_code=? LIMIT 1").bind(memberCode).first<{ id: string }>();
  if (!member) return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });

  const results = await env.DB.batch([
    env.DB.prepare("UPDATE members SET member_rank=?, updated_at=? WHERE id=?").bind(memberRank, now, member.id),
    env.DB.prepare("UPDATE studio_sessions SET plan_type=?, updated_at=?, version=version+1 WHERE member_id=? AND studio_id='FEBBRAIO' AND status='IN_USE'").bind(memberRank, now, member.id),
  ]);

  return NextResponse.json({
    memberCode,
    memberRank,
    activeSessionsUpdated: results[1]?.meta?.changes ?? 0,
  });
}
