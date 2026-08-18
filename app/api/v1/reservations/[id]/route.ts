import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  const { id } = await context.params;
  const result = await env.DB.prepare(
    `UPDATE reservations SET status = 'CANCELLED' WHERE id = ? AND member_id = ? AND status = 'CONFIRMED' AND starts_at > ?`,
  ).bind(id, member.id, Date.now()).run();
  if (!result.meta.changes) return NextResponse.json({ error: "RESERVATION_NOT_CANCELLABLE" }, { status: 409 });
  return NextResponse.json({ reservationId: id, status: "CANCELLED" });
}
