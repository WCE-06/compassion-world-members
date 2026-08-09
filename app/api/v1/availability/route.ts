import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { bookingDateRange, isBookableDate } from "@/lib/booking-window";

const STUDIO_ID = "FEBBRAIO";
const JST = "+09:00";

function bounds(date: string) {
  const start = Date.parse(`${date}T08:00:00${JST}`);
  const next = new Date(`${date}T00:00:00${JST}`); next.setUTCDate(next.getUTCDate() + 1);
  const nextDate = next.toISOString().slice(0, 10);
  return { start, end: Date.parse(`${nextDate}T02:00:00${JST}`) };
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!isBookableDate(date)) {
    return NextResponse.json({ error: "INVALID_DATE", ...bookingDateRange() }, { status: 400 });
  }
  const { start, end } = bounds(date);
  const result = await env.DB.prepare(
    `SELECT starts_at, ends_at FROM reservations
     WHERE studio_id = ? AND status = 'CONFIRMED' AND starts_at < ? AND ends_at > ?
     ORDER BY starts_at`,
  ).bind(STUDIO_ID, end, start).all<{ starts_at: number; ends_at: number }>();
  const busy = result.results.map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at }));
  const slots = Array.from({ length: 18 }, (_, index) => {
    const startsAt = start + index * 3_600_000; const endsAt = startsAt + 3_600_000;
    return { hour: 8 + index, startsAt, available: !busy.some((item) => item.startsAt < endsAt && item.endsAt > startsAt) };
  });
  return NextResponse.json({ date, opensAt: start, closesAt: end, slots, busy, ...bookingDateRange() }, { headers: { "Cache-Control": "public, max-age=20" } });
}
