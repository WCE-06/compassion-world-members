import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { catalogOverrides } from "@/db/schema";
import { requireKitchenToken } from "@/lib/kitchen-api";
import { getOrderProducts } from "@/lib/order-catalog";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  if (!await requireKitchenToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as null | { productCodes?: unknown };
  const productCodes = Array.isArray(body?.productCodes) ? body.productCodes.filter((code): code is string => typeof code === "string" && Boolean(code.trim())).map((code) => code.trim()) : [];
  if (!productCodes.length || productCodes.length > 250 || new Set(productCodes).size !== productCodes.length) return NextResponse.json({ error: "INVALID_ORDER" }, { status: 400 });
  const products = (await getOrderProducts({ includeOverrides: true, includeClosedProducts: true, allowSnapshotFallback: true })).products;
  const byCode = new Map(products.map((product) => [product.code, product]));
  if (productCodes.some((code) => !byCode.has(code))) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
  const now = new Date();
  await getDb().batch(productCodes.map((code, index) => {
    const product = byCode.get(code)!;
    return getDb().insert(catalogOverrides).values({ productCode: code, description: product.description ?? "", imageUrl: product.imageUrl ?? "", menuCategory: product.menuCategory, displaySequence: (index + 1) * 10, showOnSelfRegister: product.showOnSelfRegister, showOnMobileOrder: product.showOnMobileOrder, soldOut: product.soldOut, scheduleEnabled: product.scheduleEnabled, scheduleStart: product.scheduleStart, scheduleEnd: product.scheduleEnd, scheduleDays: product.scheduleDays.join(","), updatedBy: "kitchen-monitor", updatedAt: now }).onConflictDoUpdate({ target: catalogOverrides.productCode, set: { displaySequence: (index + 1) * 10, updatedBy: "kitchen-monitor", updatedAt: now } });
  }));
  return NextResponse.json({ ok: true, updated: productCodes.length });
}
