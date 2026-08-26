import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";
import { storedNotice,StoredNoticeRow } from "@/lib/member-notices";

export async function POST(request:NextRequest){
 const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const now=Date.now(),recent=now-12*60*60_000;
 for(let attempt=0;attempt<3;attempt++){
  const row=await env.DB.prepare(`SELECT n.id,n.event_id AS eventId,n.event_type AS eventType,n.category,n.title,n.body,n.sender,n.metadata_json AS metadataJson,n.read_at AS readAt,n.occurred_at AS occurredAt,n.created_at AS createdAt FROM member_notifications n WHERE n.member_id=? AND n.read_at IS NULL AND n.created_at>=? AND n.event_type<>'MEMBER_WELCOME' AND NOT EXISTS (SELECT 1 FROM notification_popup_deliveries d WHERE d.notification_id=n.id) ORDER BY n.created_at DESC LIMIT 1`).bind(member.id,recent).first<StoredNoticeRow>();
  if(!row)return NextResponse.json({notice:null},{headers:{"Cache-Control":"no-store"}});
  const claimed=await env.DB.prepare(`INSERT OR IGNORE INTO notification_popup_deliveries(notification_id,member_id,delivered_at) VALUES(?,?,?)`).bind(row.id,member.id,now).run();
  if(!claimed.meta.changes)continue;
  if(row.eventType==="ENTRY_THANK_YOU")await env.DB.prepare(`INSERT OR IGNORE INTO notification_popup_deliveries(notification_id,member_id,delivered_at) SELECT id,member_id,? FROM member_notifications WHERE member_id=? AND event_type='ENTRY_THANK_YOU' AND date(occurred_at/1000,'unixepoch','+9 hours')=date(?/1000,'unixepoch','+9 hours')`).bind(now,member.id,row.occurredAt??row.createdAt).run();
  return NextResponse.json({notice:storedNotice(row)},{headers:{"Cache-Control":"no-store"}});
 }
 return NextResponse.json({notice:null},{headers:{"Cache-Control":"no-store"}});
}
