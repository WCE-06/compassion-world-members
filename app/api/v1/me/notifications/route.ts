import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";
import { memberNotices, StoredNoticeRow } from "@/lib/member-notices";

export async function GET(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "LINE_AUTH_REQUIRED" }, { status: 401 });
  const [rows,profile]=await Promise.all([env.DB.prepare(`SELECT id,event_id AS eventId,event_type AS eventType,category,title,body,sender,metadata_json AS metadataJson,read_at AS readAt,occurred_at AS occurredAt,created_at AS createdAt
    FROM member_notifications WHERE member_id=? ORDER BY created_at DESC LIMIT 50`)
    .bind(member.id).all<StoredNoticeRow>(),env.DB.prepare(`SELECT m.id,m.created_at AS createdAt,(SELECT linked_at FROM identity_links WHERE member_id=m.id AND provider='LINE' AND revoked_at IS NULL ORDER BY linked_at DESC LIMIT 1) AS cardStartedAt FROM members m WHERE m.id=?`).bind(member.id).first<{id:string;createdAt:number;cardStartedAt:number|null}>()]);
  if(!profile)return NextResponse.json({error:"MEMBERSHIP_NOT_FOUND"},{status:404});
  return NextResponse.json({ notices: memberNotices(rows.results,profile) }, { headers: { "Cache-Control": "no-store" } });
}
