import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { catalogOverrides } from "@/db/schema";
import { getOrderProducts } from "@/lib/order-catalog";

function adminEmail(request: NextRequest) {
  const email = request.headers.get("oai-authenticated-user-email")?.toLowerCase();
  const allowed = ((env as unknown as Record<string, string | undefined>).ADMIN_EMAILS ?? "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (email && allowed.includes(email)) return email;
  return null;
}

export async function GET(request: NextRequest) {
  if (!adminEmail(request)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const catalog = await getOrderProducts({ includeOverrides: true });
  return NextResponse.json(catalog, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  const email = adminEmail(request);
  if (!email) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as null | Record<string, unknown>;
  const productCode = typeof body?.productCode === "string" ? body.productCode.trim() : "";
  const menuCategory = typeof body?.menuCategory === "string" ? body.menuCategory.trim() : "";
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!productCode || !menuCategory || (imageUrl && !/^https:\/\//i.test(imageUrl))) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const values = {
    productCode,
    description: typeof body?.description === "string" ? body.description.trim().slice(0, 500) : "",
    imageUrl,
    menuCategory,
    displaySequence: Math.max(0, Math.min(99999, Number(body?.displaySequence) || 0)),
    showOnSelfRegister: body?.showOnSelfRegister !== false,
    showOnMobileOrder: body?.showOnMobileOrder !== false,
    soldOut: body?.soldOut === true,
    updatedBy: email,
    updatedAt: new Date(),
  };
  await getDb().insert(catalogOverrides).values(values).onConflictDoUpdate({
    target: catalogOverrides.productCode,
    set: values,
  });
  const [saved] = await getDb().select().from(catalogOverrides).where(eq(catalogOverrides.productCode, productCode));
  return NextResponse.json({ saved });
}
