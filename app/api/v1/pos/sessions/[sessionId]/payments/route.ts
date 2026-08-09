import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { POS_SOURCE, posError, requirePosToken, validIdempotencyKey } from "@/lib/pos-api";

type PaymentBody = { result?: string; source?: string; paymentId?: string; paidAt?: number; totalExcludingTax?: number; taxAmount?: number; totalIncludingTax?: number };
type SessionRow = { id:string; status:string; payment_status:string; payment_id:string|null; version:number; total_excluding_tax:number; tax_amount:number; total_including_tax:number };

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  if (!await requirePosToken(request)) return posError("UNAUTHORIZED", "セルフレジAPIの認証に失敗しました", 401);
  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  if (!validIdempotencyKey(idempotencyKey)) return posError("INVALID_IDEMPOTENCY_KEY", "Idempotency-Keyは16〜128文字で指定してください", 400);
  const { sessionId } = await context.params;
  const body = await request.json().catch(() => null) as PaymentBody | null;
  if (!body || body.result !== "SUCCESS" || body.source !== POS_SOURCE || !body.paymentId || !Number.isInteger(body.paidAt))
    return posError("INVALID_PAYMENT_NOTIFICATION", "決済成功通知の形式が不正です", 400);
  const duplicate = await env.DB.prepare("SELECT session_id, payment_id FROM pos_payment_events WHERE idempotency_key = ? LIMIT 1").bind(idempotencyKey).first<{session_id:string;payment_id:string}>();
  if (duplicate) {
    if (duplicate.session_id !== sessionId || duplicate.payment_id !== body.paymentId) return posError("IDEMPOTENCY_KEY_REUSED", "別の決済で使用済みの冪等性キーです", 409);
    return NextResponse.json({ sessionId, status:"COMPLETED", paymentStatus:"PAID", paymentId:body.paymentId, idempotentReplay:true });
  }
  const session = await env.DB.prepare("SELECT id, status, payment_status, payment_id, version, total_excluding_tax, tax_amount, total_including_tax FROM studio_sessions WHERE id = ? AND studio_id = 'FEBBRAIO' LIMIT 1").bind(sessionId).first<SessionRow>();
  if (!session) return posError("SESSION_NOT_FOUND", "対象セッションがありません", 404);
  if (session.payment_status === "PAID" && session.payment_id === body.paymentId)
    return NextResponse.json({ sessionId, status:"COMPLETED", paymentStatus:"PAID", paymentId:body.paymentId, idempotentReplay:true });
  if (session.status !== "IN_USE" || session.payment_status !== "UNPAID") return posError("SESSION_NOT_PAYABLE", "精算可能な状態ではありません", 409);
  if (body.totalExcludingTax !== session.total_excluding_tax || body.taxAmount !== session.tax_amount || body.totalIncludingTax !== session.total_including_tax)
    return posError("AMOUNT_MISMATCH", "セッションの確定金額と一致しません", 409);
  const now = Date.now();
  const update = await env.DB.prepare(
    `UPDATE studio_sessions SET status='COMPLETED', payment_status='PAID', payment_id=?, checked_out_at=?, version=version+1, updated_at=?
      WHERE id=? AND version=? AND status='IN_USE' AND payment_status='UNPAID'`,
  ).bind(body.paymentId, body.paidAt, now, sessionId, session.version).run();
  if (!update.meta.changes) return posError("SESSION_CONFLICT", "セッションが更新されています。再取得してください", 409);
  await env.DB.prepare(
    `INSERT INTO pos_payment_events (id,idempotency_key,session_id,payment_id,source,total_excluding_tax,tax_amount,total_including_tax,paid_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind(crypto.randomUUID(),idempotencyKey,sessionId,body.paymentId,body.source,body.totalExcludingTax,body.taxAmount,body.totalIncludingTax,body.paidAt,now).run();
  return NextResponse.json({ sessionId, status:"COMPLETED", paymentStatus:"PAID", paymentId:body.paymentId, checkedOutAt:body.paidAt, idempotentReplay:false });
}
