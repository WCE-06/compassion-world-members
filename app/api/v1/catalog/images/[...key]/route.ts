import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

function bucket() {
  return (env as unknown as { PRODUCT_IMAGES: R2Bucket }).PRODUCT_IMAGES;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const object = await bucket().get(key.join("/"));
  if (!object) return new NextResponse("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new NextResponse(object.body, { headers });
}
