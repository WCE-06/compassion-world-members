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
  if (Array.isArray(body?.order)) {
    const order = body.order.filter((code): code is string => typeof code === "string").slice(0, 500);
    const now = new Date();
    const catalog=(await getOrderProducts({includeOverrides:true})).products;
    await getDb().batch(order.map((code, index) => {const product=catalog.find(item=>item.code===code);return getDb().insert(catalogOverrides).values({productCode:code,description:product?.description??"",imageUrl:product?.imageUrl??"",menuCategory:product?.menuCategory??"food-side",displaySequence:(index+1)*10,showOnSelfRegister:product?.showOnSelfRegister??true,showOnMobileOrder:product?.showOnMobileOrder??true,soldOut:product?.soldOut??false,scheduleEnabled:product?.scheduleEnabled??false,scheduleStart:product?.scheduleStart??"11:00",scheduleEnd:product?.scheduleEnd??"20:00",scheduleDays:(product?.scheduleDays??[1,2,3,4,5,6,7]).join(","),updatedBy:email,updatedAt:now}).onConflictDoUpdate({target:catalogOverrides.productCode,set:{displaySequence:(index+1)*10,updatedBy:email,updatedAt:now}})}));
    return NextResponse.json({saved:true,count:order.length});
  }
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
    scheduleEnabled: body?.scheduleEnabled === true,
    scheduleStart: typeof body?.scheduleStart === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.scheduleStart) ? body.scheduleStart : "11:00",
    scheduleEnd: typeof body?.scheduleEnd === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.scheduleEnd) ? body.scheduleEnd : "20:00",
    scheduleDays: Array.isArray(body?.scheduleDays) ? [...new Set(body.scheduleDays.map(Number).filter(day => day >= 1 && day <= 7))].sort().join(",") || "1,2,3,4,5,6,7" : "1,2,3,4,5,6,7",
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
