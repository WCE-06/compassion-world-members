import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function GET(){const runtime=env as unknown as Record<string,string|undefined>;return NextResponse.json({liffId:runtime.LINE_LIFF_ID??runtime.NEXT_PUBLIC_LIFF_ID??""},{headers:{"Cache-Control":"public, max-age=300"}})}
