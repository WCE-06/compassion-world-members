import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { posError, requirePosToken } from "@/lib/pos-api";

type ActiveUsageRow = {
  checked_in_at: number | null;
  plan_type: "STANDARD" | "RESIDENT" | null;
};

export async function GET(request: NextRequest) {
  if (!await requirePosToken(request)) {
    return posError("UNAUTHORIZED", "セルフレジAPIの認証に失敗しました", 401);
  }

  const memberCode = request.nextUrl.searchParams.get("memberCode")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(memberCode)) {
    return posError("INVALID_MEMBER_CODE", "会員証コードの形式が不正です", 400);
  }

  const result = await env.DB.prepare(
    `SELECT s.checked_in_at, s.plan_type
       FROM studio_sessions s
       JOIN members m ON m.id = s.member_id
      WHERE m.member_code = ?
        AND s.studio_id = 'FEBBRAIO'
        AND s.status = 'IN_USE'
      ORDER BY s.checked_in_at DESC
      LIMIT 2`,
  ).bind(memberCode).all<ActiveUsageRow>();

  if (result.results.length === 0) {
    return NextResponse.json(
      { found: false, code: "NO_ACTIVE_USAGE" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (result.results.length > 1) {
    return posError("MULTIPLE_ACTIVE_USAGES", "利用中ログが複数あります", 409);
  }

  const usage = result.results[0];
  if (usage.checked_in_at === null || !usage.plan_type) {
    return posError("ACTIVE_USAGE_INCOMPLETE", "利用中ログの開始時刻または会員区分が未設定です", 409);
  }

  const elapsedMs = Math.max(0, Date.now() - usage.checked_in_at);
  const usageMinutes = Math.floor(elapsedMs / 60_000);
  const billingHours = Math.min(10, Math.max(1, Math.ceil(elapsedMs / 3_600_000)));
  const prefix = usage.plan_type === "RESIDENT" ? "STR" : "STN";

  return NextResponse.json({
    found: true,
    memberCode,
    checkedInAt: usage.checked_in_at,
    memberRank: usage.plan_type,
    usageMinutes,
    billingHours,
    productCode: `${prefix}${String(billingHours).padStart(2, "0")}`,
  }, { headers: { "Cache-Control": "no-store" } });
}
