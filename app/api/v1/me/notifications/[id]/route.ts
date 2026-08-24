import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "LINE_AUTH_REQUIRED" }, { status: 401 });
  const { id } = await context.params;
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return NextResponse.json({ error: "INVALID_NOTIFICATION_ID" }, { status: 400 });
  const result = await env.DB.prepare("UPDATE member_notifications SET read_at=COALESCE(read_at,?),updated_at=? WHERE id=? AND member_id=?")
    .bind(Date.now(), Date.now(), id, member.id).run();
  if (!result.meta.changes) return NextResponse.json({ error: "NOTIFICATION_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

