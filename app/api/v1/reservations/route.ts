import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { bookingDateRange, isBookableDate } from "@/lib/booking-window";
import { authenticatedMember } from "@/lib/member-auth";

export async function GET(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  const result = await env.DB.prepare(
    `SELECT id, studio_id AS studioId, starts_at AS startsAt, ends_at AS endsAt, status, created_at AS createdAt
     FROM reservations WHERE member_id = ? ORDER BY starts_at DESC LIMIT 30`,
  ).bind(member.id).all();
  return NextResponse.json({ reservations: result.results });
}

export async function POST(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { date?: string; startHour?: number; durationHours?: number; requestId?: string } | null;
  const date = body?.date ?? ""; const startHour = Number(body?.startHour); const duration = Number(body?.durationHours);
  if (!isBookableDate(date) || !Number.isInteger(startHour) || startHour < 8 || startHour > 25 || !Number.isInteger(duration) || duration < 1 || duration > 10 || startHour + duration > 26)
    return NextResponse.json({ error: "INVALID_RESERVATION_WINDOW", ...bookingDateRange() }, { status: 400 });
  const baseDate = new Date(`${date}T12:00:00+09:00`); if (startHour >= 24) baseDate.setDate(baseDate.getDate() + 1);
  const actualHour = startHour >= 24 ? startHour - 24 : startHour;
  const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(baseDate);
  const startsAt = Date.parse(`${localDate}T${String(actualHour).padStart(2, "0")}:00:00+09:00`);
  const endsAt = startsAt + duration * 3_600_000;
  if (startsAt <= Date.now()) return NextResponse.json({ error: "START_TIME_PASSED" }, { status: 409 });
  const id = body?.requestId?.match(/^[a-zA-Z0-9-]{10,80}$/) ? `res_${body.requestId}` : crypto.randomUUID();
  const existing = await env.DB.prepare(`SELECT id, starts_at AS startsAt, ends_at AS endsAt, status FROM reservations WHERE id = ? AND member_id = ?`).bind(id, member.id).first();
  if (existing) return NextResponse.json({ reservationId: id, ...existing }, { status: 200 });
  const result = await env.DB.prepare(
    `INSERT INTO reservations (id, member_id, studio_id, starts_at, ends_at, status, created_at)
     SELECT ?, ?, 'FEBBRAIO', ?, ?, 'CONFIRMED', ?
     WHERE NOT EXISTS (SELECT 1 FROM reservations WHERE studio_id = 'FEBBRAIO' AND status = 'CONFIRMED' AND starts_at < ? AND ends_at > ?)`,
  ).bind(id, member.id, startsAt, endsAt, Date.now(), endsAt, startsAt).run();
  if (!result.meta.changes) return NextResponse.json({ error: "SLOT_ALREADY_RESERVED" }, { status: 409 });
  return NextResponse.json({ reservationId: id, startsAt, endsAt, status: "CONFIRMED" }, { status: 201 });
}
