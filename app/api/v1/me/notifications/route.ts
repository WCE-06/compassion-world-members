import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";
import { memberNotices, StoredNoticeRow } from "@/lib/member-notices";

export async function GET(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "LINE_AUTH_REQUIRED" }, { status: 401 });
  const [rows,profile]=await Promise.all([env.DB.prepare(`SELECT n.id,n.event_id AS eventId,n.event_type AS eventType,n.category,n.title,n.body,n.sender,n.metadata_json AS metadataJson,CASE WHEN n.event_type='ENTRY_THANK_YOU' AND d.notification_id IS NOT NULL THEN COALESCE(n.read_at,d.delivered_at) ELSE n.read_at END AS readAt,n.occurred_at AS occurredAt,n.created_at AS createdAt
    FROM member_notifications n LEFT JOIN notification_popup_deliveries d ON d.notification_id=n.id WHERE n.member_id=? ORDER BY n.created_at DESC LIMIT 50`)
    .bind(member.id).all<StoredNoticeRow>(),env.DB.prepare(`SELECT m.id,m.created_at AS createdAt,(SELECT linked_at FROM identity_links WHERE member_id=m.id AND provider='LINE' AND revoked_at IS NULL ORDER BY linked_at DESC LIMIT 1) AS cardStartedAt FROM members m WHERE m.id=?`).bind(member.id).first<{id:string;createdAt:number;cardStartedAt:number|null}>()]);
  if(!profile)return NextResponse.json({error:"MEMBERSHIP_NOT_FOUND"},{status:404});
  return NextResponse.json({ notices: memberNotices(rows.results,profile) }, { headers: { "Cache-Control": "no-store" } });
}
