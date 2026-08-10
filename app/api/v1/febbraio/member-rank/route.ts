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
