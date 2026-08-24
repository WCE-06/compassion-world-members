import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireCheckinNotificationToken } from "@/lib/checkin-notification";

type EntryThankYou = {
  eventType?: string;
  eventId?: string;
  occurredAt?: string | number;
  memberCode?: string;
  memberId?: string;
  memberName?: string;
  rank?: string;
  pointGranted?: boolean;
  alreadyGranted?: boolean;
  grantedPoint?: number;
  pointsGranted?: number;
  visitPoints?: number;
  visitPointGranted?: boolean;
  pointReason?: string;
  pointError?: string;
  storeCode?: string;
  storeName?: string;
};

function messageFor(body: EntryThankYou, memberName: string) {
  const storeName = body.storeName?.trim() || "COMPASSION WORLD 本館";
  const rank = String(body.rank ?? "STANDARD").toUpperCase();
  const points = Math.max(0, Math.floor(Number(body.grantedPoint) || 0));
  const greeting = `${memberName || "お客様"} 様\n\n本日は${storeName}へご来店いただき、ありがとうございます。`;
  if (body.pointGranted && points > 0) {
    return `${greeting}\n\n本日の来店ポイントとして、${rank}ランク特典の${points}ポイントを付与しました。\n\n来店ポイントは1日1回、現在の会員ランクに応じて付与されます。\n\nどうぞごゆっくりお過ごしください。\nまたのご来店を心よりお待ちしております。`;
  }
  if (body.alreadyGranted) {
    return `${greeting}\n\n本日の来店ポイントは、初回のご来店時に付与済みです。\n\nどうぞごゆっくりお過ごしください。\nまたのご来店を心よりお待ちしております。`;
  }
  return `${greeting}\n\n来店ポイントは現在確認中です。ポイント履歴への反映まで少しお待ちください。\n\nどうぞごゆっくりお過ごしください。\nまたのご来店を心よりお待ちしております。`;
}

function normalizedPointResult(body: EntryThankYou): EntryThankYou {
  const grantedPoint = Math.max(0, Math.floor(Number(body.grantedPoint ?? body.pointsGranted ?? body.visitPoints) || 0));
  return { ...body, grantedPoint, pointGranted: body.pointGranted ?? body.visitPointGranted ?? grantedPoint > 0 };
}

export async function POST(request: NextRequest) {
  if (!await requireCheckinNotificationToken(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as EntryThankYou | null;
  const eventId = body?.eventId?.trim() ?? "";
  const memberCode = body?.memberCode?.trim().toUpperCase() ?? "";
  const occurredAt = typeof body?.occurredAt === "number" ? body.occurredAt : Date.parse(String(body?.occurredAt ?? ""));
  if (body?.eventType !== "ENTRY_THANK_YOU" || !/^[A-Za-z0-9:_-]{8,160}$/.test(eventId) || !/^[A-Z0-9]{10}$/.test(memberCode) || !Number.isFinite(occurredAt)) {
    return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }
  const result = normalizedPointResult(body);
  const member = await env.DB.prepare("SELECT id,display_name AS displayName,status FROM members WHERE member_code=? LIMIT 1")
    .bind(memberCode).first<{ id: string; displayName: string; status: string }>();
  if (!member) return NextResponse.json({ ok: false, error: "MEMBER_NOT_FOUND" }, { status: 404 });
  if (member.status !== "ACTIVE") return NextResponse.json({ ok: false, error: "MEMBER_INACTIVE" }, { status: 403 });
  if (body.memberId && body.memberId !== member.id) return NextResponse.json({ ok: false, error: "MEMBER_MISMATCH" }, { status: 409 });
  const now = Date.now();
  const id = crypto.randomUUID();
  const metadata = {
    rank: String(body.rank ?? "STANDARD").toUpperCase(),
    pointGranted: Boolean(result.pointGranted),
    alreadyGranted: Boolean(result.alreadyGranted),
    grantedPoint: result.grantedPoint,
    pointReason: body.pointReason ?? "DAILY_CHECKIN",
    pointError: body.pointError ?? null,
    storeCode: body.storeCode ?? "MAIN_BUILDING",
    storeName: body.storeName ?? "COMPASSION WORLD 本館",
  };
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO member_notifications
    (id,event_id,member_id,event_type,category,title,body,sender,channel,delivery_status,metadata_json,occurred_at,created_at,updated_at)
    VALUES (?,?,?,'ENTRY_THANK_YOU','POINT',?,?,'COMPASSION WORLD','CARD','SAVED',?,?,?,?)`)
    .bind(id, eventId, member.id, "COMPASSION WORLDへご来店ありがとうございます", messageFor(result, member.displayName), JSON.stringify(metadata), occurredAt, now, now).run();
  if (!inserted.meta.changes) {
    const existing = await env.DB.prepare("SELECT id FROM member_notifications WHERE event_id=? LIMIT 1").bind(eventId).first<{ id: string }>();
    const confirmed = (result.pointGranted && Number(result.grantedPoint)>0) || result.alreadyGranted;
    if (existing && confirmed) await env.DB.prepare("UPDATE member_notifications SET body=?,metadata_json=?,read_at=NULL,updated_at=? WHERE id=?")
      .bind(messageFor(result, member.displayName), JSON.stringify(metadata), now, existing.id).run();
    return NextResponse.json({ ok: true, duplicate: true, updated: Boolean(existing&&confirmed), notificationId: existing?.id ?? null });
  }
  return NextResponse.json({ ok: true, duplicate: false, notificationId: id }, { status: 201 });
}
