import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { bookingDateRange, isBookableDate } from "@/lib/booking-window";

type LineProfile = { userId: string };
async function lineProfile(request: NextRequest): Promise<LineProfile | null> {
  const auth = request.headers.get("authorization") ?? ""; if (!auth.startsWith("Bearer ")) return null;
  const response = await fetch("https://api.line.me/v2/profile", { headers: { Authorization: auth }, cache: "no-store" });
  return response.ok ? response.json() as Promise<LineProfile> : null;
}
export async function POST(request: NextRequest) {
  const profile = await lineProfile(request); if (!profile) return NextResponse.json({ error: "LINE_LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { date?: string; startHour?: number; durationHours?: number } | null;
  const date = body?.date ?? ""; const startHour = Number(body?.startHour); const duration = Number(body?.durationHours);
  if (!isBookableDate(date) || !Number.isInteger(startHour) || startHour < 8 || startHour > 25 || !Number.isInteger(duration) || duration < 1 || duration > 10 || startHour + duration > 26)
    return NextResponse.json({ error: "INVALID_RESERVATION_WINDOW", ...bookingDateRange() }, { status: 400 });
  const member = await env.DB.prepare(
    `SELECT m.id FROM identity_links i JOIN members m ON m.id = i.member_id
     WHERE i.provider = 'LINE' AND i.provider_user_id = ? AND i.revoked_at IS NULL AND m.status = 'ACTIVE' LIMIT 1`,
  ).bind(profile.userId).first<{ id: string }>();
  if (!member) return NextResponse.json({ error: "MEMBERSHIP_NOT_LINKED" }, { status: 403 });
  const baseDate = new Date(`${date}T12:00:00+09:00`); if (startHour >= 24) baseDate.setDate(baseDate.getDate() + 1);
  const actualHour = startHour >= 24 ? startHour - 24 : startHour;
  const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(baseDate);
  const startsAt = Date.parse(`${localDate}T${String(actualHour).padStart(2, "0")}:00:00+09:00`);
  const endsAt = startsAt + duration * 3_600_000; if (startsAt <= Date.now()) return NextResponse.json({ error: "START_TIME_PASSED" }, { status: 409 });
  const id = crypto.randomUUID();
  const result = await env.DB.prepare(
    `INSERT INTO reservations (id, member_id, studio_id, starts_at, ends_at, status, created_at)
     SELECT ?, ?, 'FEBBRAIO', ?, ?, 'CONFIRMED', ?
     WHERE NOT EXISTS (SELECT 1 FROM reservations WHERE studio_id = 'FEBBRAIO' AND status = 'CONFIRMED' AND starts_at < ? AND ends_at > ?)`,
  ).bind(id, member.id, startsAt, endsAt, Date.now(), endsAt, startsAt).run();
  if (!result.meta.changes) return NextResponse.json({ error: "SLOT_ALREADY_RESERVED" }, { status: 409 });
  return NextResponse.json({ reservationId: id, startsAt, endsAt, status: "CONFIRMED" }, { status: 201 });
}
