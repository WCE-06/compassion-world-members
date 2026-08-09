import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { posError, requirePosToken } from "@/lib/pos-api";

type SessionRow = {
  session_id: string; member_code: string; studio_id: string; reservation_id: string | null;
  checked_in_at: number; scheduled_ends_at: number; status: string; payment_status: string;
  plan_type: string; product_code: string; unit_price_excluding_tax: number; tax_rate_bps: number;
  total_excluding_tax: number; tax_amount: number; total_including_tax: number; version: number;
};

export async function GET(request: NextRequest) {
  if (!await requirePosToken(request)) return posError("UNAUTHORIZED", "セルフレジAPIの認証に失敗しました", 401);
  const memberCode = request.nextUrl.searchParams.get("memberCode")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(memberCode)) return posError("INVALID_MEMBER_CODE", "会員証コードの形式が不正です", 400);
  const rows = await env.DB.prepare(
    `SELECT s.id AS session_id, m.member_code, s.studio_id, s.reservation_id,
            s.checked_in_at, s.scheduled_ends_at, s.status, s.payment_status,
            s.plan_type, s.product_code, s.unit_price_excluding_tax, s.tax_rate_bps,
            s.total_excluding_tax, s.tax_amount, s.total_including_tax, s.version
       FROM studio_sessions s JOIN members m ON m.id = s.member_id
      WHERE m.member_code = ? AND s.studio_id = 'FEBBRAIO'
        AND s.status = 'IN_USE' AND s.payment_status = 'UNPAID'
      ORDER BY s.checked_in_at DESC LIMIT 2`,
  ).bind(memberCode).all<SessionRow>();
  if (rows.results.length === 0) return posError("SESSION_NOT_FOUND", "精算対象の利用中セッションがありません", 404);
  if (rows.results.length > 1) return posError("MULTIPLE_ACTIVE_SESSIONS", "利用中セッションが複数あります", 409);
  const row = rows.results[0];
  const required = [row.checked_in_at,row.scheduled_ends_at,row.plan_type,row.product_code,row.unit_price_excluding_tax,row.tax_rate_bps,row.total_excluding_tax,row.tax_amount,row.total_including_tax];
  if (required.some(value => value === null || value === undefined)) return posError("PRICE_NOT_READY", "料金情報が確定していません", 409);
  return NextResponse.json({
    sessionId: row.session_id, memberCode: row.member_code, studioId: row.studio_id,
    reservationId: row.reservation_id, checkedInAt: row.checked_in_at, scheduledEndsAt: row.scheduled_ends_at,
    status: row.status, paymentStatus: row.payment_status, planType: row.plan_type,
    productCode: row.product_code, unitPriceExcludingTax: row.unit_price_excluding_tax,
    taxRateBps: row.tax_rate_bps, totalExcludingTax: row.total_excluding_tax,
    taxAmount: row.tax_amount, totalIncludingTax: row.total_including_tax,
    currency: "JPY", amountBasis: "BOTH", version: row.version,
  }, { headers: { "Cache-Control": "no-store" } });
}
