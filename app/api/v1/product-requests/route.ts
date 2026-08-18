import { NextRequest, NextResponse } from "next/server";

const VALID_KINDS = new Set(["ORDER", "STOCK", "IDEA"]);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as null | Record<string, unknown>;
  const kind = typeof body?.kind === "string" ? body.kind : "";
  const productName = typeof body?.productName === "string" ? body.productName.trim() : "";
  const details = typeof body?.details === "string" ? body.details.trim().slice(0, 1000) : "";
  const quantity = typeof body?.quantity === "string" ? body.quantity.trim().slice(0, 50) : "";
  const contactAllowed = body?.contactAllowed === true;

  if (!VALID_KINDS.has(kind) || !productName || productName.length > 100) {
    return NextResponse.json({ message: "入力内容を確認してください" }, { status: 400 });
  }

  const gasUrl = process.env.COMMON_FACILITY_GAS_URL;
  const apiKey = process.env.COMMON_FACILITY_GAS_API_KEY;
  if (!gasUrl) {
    return NextResponse.json({ accepted: true, saved: false });
  }

  const response = await fetch(gasUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { "X-API-Key": apiKey } : {}) },
    body: JSON.stringify({ action: "createProductRequest", requestId: crypto.randomUUID(), kind, productName, details, quantity, contactAllowed, source: "POINT_CARD", occurredAt: new Date().toISOString() }),
    cache: "no-store",
  });

  if (!response.ok) return NextResponse.json({ message: "受付先へ接続できませんでした" }, { status: 502 });
  return NextResponse.json({ accepted: true, saved: true });
}
