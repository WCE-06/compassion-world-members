import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "LINE_AUTH_REQUIRED" }, { status: 401 });
  const { id } = await context.params;
  // Notification producers use UUIDs as well as stable IDs such as
  // `notice_order_<id>` and `notice_ready_<id>`. Keep this allowlist aligned
  // with those server-generated identifiers while rejecting path/control data.
  if (!/^[A-Za-z0-9:_-]{8,160}$/.test(id)) return NextResponse.json({ error: "INVALID_NOTIFICATION_ID" }, { status: 400 });
  const now=Date.now();
  const [,result] = await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO notification_popup_deliveries(notification_id,member_id,delivered_at)
      SELECT id,member_id,? FROM member_notifications WHERE id=? AND member_id=?`).bind(now,id,member.id),
    env.DB.prepare("UPDATE member_notifications SET read_at=COALESCE(read_at,?),updated_at=? WHERE id=? AND member_id=?").bind(now,now,id,member.id),
  ]);
  if (!result.meta.changes) return NextResponse.json({ error: "NOTIFICATION_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
