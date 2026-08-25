import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function bucket() {
  return (env as unknown as { PRODUCT_IMAGES: R2Bucket }).PRODUCT_IMAGES;
}

export async function POST(request: NextRequest) {
  if (!await requireAdminSession(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  const productCode = String(form?.get("productCode") ?? "").trim().replace(/[^0-9A-Za-z_-]/g, "").slice(0, 80);
  if (!(file instanceof File) || !productCode) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const extension = allowedTypes.get(file.type);
  if (!extension) return NextResponse.json({ error: "UNSUPPORTED_IMAGE_TYPE" }, { status: 415 });
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 413 });
  const key = `products/${productCode}/${crypto.randomUUID()}.${extension}`;
  await bucket().put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { productCode },
  });
  const imageUrl = `${new URL(request.url).origin}/api/v1/catalog/images/${key.split("/").map(encodeURIComponent).join("/")}`;
  return NextResponse.json({ imageUrl });
}
