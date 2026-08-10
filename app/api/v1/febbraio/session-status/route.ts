import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

async function authorized(request: NextRequest) {
  const configured = (env as unknown as { RECEPTION_API_TOKEN?: string }).RECEPTION_API_TOKEN ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!configured || !supplied) return false;
  const digest = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [expected, actual] = await Promise.all([digest(configured), digest(supplied)]);
  const left = new Uint8Array(expected), right = new Uint8Array(actual);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function GET(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)) return NextResponse.json({ error: "INVALID_SESSION_ID" }, { status: 400 });
  if (request.nextUrl.searchParams.get("complete") === "1") {
    const now = Date.now();
    const paymentId = request.nextUrl.searchParams.get("paymentId")?.trim() || `confirmed:${sessionId}`;
    await env.DB.prepare(
      `UPDATE studio_sessions
          SET status='COMPLETED', payment_status='PAID', payment_id=?, checked_out_at=?, updated_at=?, version=version+1
        WHERE id=? AND studio_id='FEBBRAIO' AND status='IN_USE'`,
    ).bind(paymentId, now, now, sessionId).run();
  }
  const session = await env.DB.prepare(
    "SELECT status, payment_status FROM studio_sessions WHERE id=? AND studio_id='FEBBRAIO' LIMIT 1",
  ).bind(sessionId).first<{ status: string; payment_status: string }>();
  if (!session) return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    sessionId,
    status: session.payment_status === "PAID" || session.status === "COMPLETED" ? "PAID" : "ACTIVE",
    sessionStatus: session.status,
    paymentStatus: session.payment_status,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { sessionId?: string; paymentId?: string } | null;
  const sessionId = body?.sessionId?.trim() ?? "";
  const paymentId = body?.paymentId?.trim() || `confirmed:${sessionId}`;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)) return NextResponse.json({ error: "INVALID_SESSION_ID" }, { status: 400 });
  const now = Date.now();
  const result = await env.DB.prepare(
    `UPDATE studio_sessions
        SET status='COMPLETED', payment_status='PAID', payment_id=?, checked_out_at=?, updated_at=?, version=version+1
      WHERE id=? AND studio_id='FEBBRAIO' AND status='IN_USE'`,
  ).bind(paymentId, now, now, sessionId).run();
  if ((result.meta.changes ?? 0) === 0) {
    const existing = await env.DB.prepare("SELECT status,payment_status FROM studio_sessions WHERE id=? LIMIT 1")
      .bind(sessionId).first<{ status: string; payment_status: string }>();
    if (!existing) return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    if (existing.status !== "COMPLETED" || existing.payment_status !== "PAID") {
      return NextResponse.json({ error: "SESSION_NOT_ACTIVE" }, { status: 409 });
    }
  }
  return NextResponse.json({ sessionId, status: "PAID", sessionStatus: "COMPLETED", paymentStatus: "PAID" });
}
