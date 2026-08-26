import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { catalogOverrides } from "@/db/schema";
import { requireKitchenToken } from "@/lib/kitchen-api";
import { getOrderProducts } from "@/lib/order-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!await requireKitchenToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const products = (await getOrderProducts({ includeOverrides: true, includeClosedProducts: true, allowSnapshotFallback: true })).products;
  return NextResponse.json({ products: products.map((product) => ({ productCode: product.code, showOnSelfRegister: product.showOnSelfRegister, showOnMobileOrder: product.showOnMobileOrder })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!await requireKitchenToken(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as null | { productCode?: unknown; published?: unknown };
  const productCode = typeof body?.productCode === "string" ? body.productCode.trim() : "";
  if (!productCode || typeof body?.published !== "boolean") return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const catalog = (await getOrderProducts({ includeOverrides: true, includeClosedProducts: true, allowSnapshotFallback: true })).products;
  const product = catalog.find((item) => item.code === productCode);
  if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
  const [existing] = await getDb().select().from(catalogOverrides).where(eq(catalogOverrides.productCode, productCode));
  const now = new Date();
  const values = { productCode, description: existing?.description ?? product.description ?? "", imageUrl: existing?.imageUrl ?? product.imageUrl ?? "", menuCategory: existing?.menuCategory ?? product.menuCategory, displaySequence: existing?.displaySequence ?? product.displaySequence ?? 9999, showOnSelfRegister: body.published, showOnMobileOrder: body.published, soldOut: existing?.soldOut ?? product.soldOut ?? false, scheduleEnabled: existing?.scheduleEnabled ?? product.scheduleEnabled ?? false, scheduleStart: existing?.scheduleStart ?? product.scheduleStart ?? "11:00", scheduleEnd: existing?.scheduleEnd ?? product.scheduleEnd ?? "20:00", scheduleDays: existing?.scheduleDays ?? product.scheduleDays?.join(",") ?? "1,2,3,4,5,6,7", updatedBy: "kitchen-monitor", updatedAt: now };
  await getDb().insert(catalogOverrides).values(values).onConflictDoUpdate({ target: catalogOverrides.productCode, set: { showOnSelfRegister: body.published, showOnMobileOrder: body.published, updatedBy: "kitchen-monitor", updatedAt: now } });
  return NextResponse.json({ productCode, published: body.published, showOnSelfRegister: body.published, showOnMobileOrder: body.published });
}
