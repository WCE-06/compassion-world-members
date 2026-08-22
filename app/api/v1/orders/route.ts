import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";
import { getOrderProducts } from "@/lib/order-catalog";
import { pointRuleFor } from "@/lib/point-policy";

export async function GET(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  const result = await env.DB.prepare(
    `SELECT id, order_number AS orderNumber, status, payment_method AS paymentMethod, total_including_tax AS totalIncludingTax,
     point_eligible AS pointEligible, point_status AS pointStatus, points_earned AS pointsEarned,
     pickup_at AS pickupAt, expires_at AS expiresAt, created_at AS createdAt FROM orders WHERE member_id = ? ORDER BY created_at DESC LIMIT 20`,
  ).bind(member.id).all();
  return NextResponse.json({ orders: result.results });
}

export async function POST(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { items?: { productId?: string; quantity?: number }[]; pickupAt?: number; requestId?: string; paymentMethod?: "STORE"|"STRIPE" } | null;
  const requested = body?.items ?? [];
  const {products}=await getOrderProducts();
  const items = requested.map(item => {
    const product = products.find(candidate => candidate.id === item.productId&&!candidate.soldOut);
    const quantity = Number(item.quantity);
    return product && Number.isInteger(quantity) && quantity > 0 && quantity <= 20 ? { product, quantity } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!items.length || items.length !== requested.length) return NextResponse.json({ error: "INVALID_ORDER_ITEMS" }, { status: 400 });
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const paymentMethod = body?.paymentMethod === "STRIPE" ? "STRIPE" : "STORE";
  const runtime = env as unknown as Record<string,string|undefined>;
  if (paymentMethod === "STRIPE" && runtime.SMART_PAYMENT_ENABLED !== "true") return NextResponse.json({ error:"SMART_PAYMENT_NOT_READY", message:"スマート決済は現在準備中です" }, { status:503 });
  const pointRule = pointRuleFor("MOBILE_ORDER");
  const requestId = body?.requestId?.match(/^[a-zA-Z0-9-]{10,80}$/) ? body.requestId : crypto.randomUUID();
  const id = `ord_${requestId}`;
  const existing = await env.DB.prepare(`SELECT order_number AS orderNumber, status, total_including_tax AS totalIncludingTax FROM orders WHERE id = ? AND member_id = ?`).bind(id, member.id).first();
  if (existing) return NextResponse.json({ orderId: id, ...existing });
  const now = Date.now(); const orderNumber = `A-${String(now).slice(-5)}`; const expiresAt = now + 15 * 60_000;
  await env.DB.prepare(
    `INSERT INTO orders (id, order_number, member_id, status, payment_method, total_including_tax, point_eligible, point_status, pickup_at, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
  ).bind(id, orderNumber, member.id, paymentMethod === "STRIPE" ? "PENDING_PAYMENT" : "WAITING_STORE_PAYMENT", paymentMethod, total, pointRule.eligible ? 1 : 0, body?.pickupAt ?? null, expiresAt, now, now).run();
  for (const item of items) await env.DB.prepare(
    `INSERT INTO order_items (id, order_id, product_id, product_code, product_name, quantity, unit_price_including_tax, line_total_including_tax)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), id, item.product.id, item.product.code, item.product.name, item.quantity, item.product.price, item.product.price * item.quantity).run();
  return NextResponse.json({ orderId: id, orderNumber, status: paymentMethod === "STRIPE" ? "PENDING_PAYMENT" : "WAITING_STORE_PAYMENT", paymentMethod, paymentLabel:paymentMethod === "STRIPE" ? "スマート決済" : "現地決済", pointEligible:pointRule.eligible, pointStatus:"PENDING", totalIncludingTax: total, expiresAt }, { status: 201 });
}
