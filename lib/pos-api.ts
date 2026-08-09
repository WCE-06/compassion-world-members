import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

export const POS_SOURCE = "FEBBRAIO_SELF_REGISTER";

export function posError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status });
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function requirePosToken(request: NextRequest) {
  const configured = (env as unknown as { POS_API_TOKEN?: string }).POS_API_TOKEN ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!configured || !supplied) return false;
  const [expected, actual] = await Promise.all([digest(configured), digest(supplied)]);
  if (expected.length !== actual.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ actual[index];
  return difference === 0;
}

export function validIdempotencyKey(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(value);
}
