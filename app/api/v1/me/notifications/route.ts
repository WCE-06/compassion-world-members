import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";

export async function GET(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "LINE_AUTH_REQUIRED" }, { status: 401 });
  const rows = await env.DB.prepare(`SELECT id,category,title,body,sender,read_at AS readAt,created_at AS createdAt
    FROM member_notifications WHERE member_id=? ORDER BY created_at DESC LIMIT 50`)
    .bind(member.id).all<{ id:string;category:"PAYMENT"|"POINT"|"RESERVATION"|"ORDER"|"NEWS";title:string;body:string;sender:string;readAt:number|null;createdAt:number }>();
  return NextResponse.json({ notices: rows.results.map(item=>({
    id:item.id,category:item.category,title:item.title,body:item.body,sender:item.sender,
    createdAt:new Date(item.createdAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}),
    unread:!item.readAt,
  })) }, { headers: { "Cache-Control": "no-store" } });
}
