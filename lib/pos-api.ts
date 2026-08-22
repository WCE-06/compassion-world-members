import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

export function posError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status });
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function requirePosToken(request: NextRequest) {
  const secrets = env as unknown as {
    POS_API_TOKEN?: string;
    SELF_REGISTER_POS_API_TOKEN?: string;
  };
  const configured = [secrets.POS_API_TOKEN, secrets.SELF_REGISTER_POS_API_TOKEN]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (configured.length === 0 || !supplied) return false;

  const [actual, ...expectedTokens] = await Promise.all([
    digest(supplied),
    ...configured.map((token) => digest(token)),
  ]);

  return expectedTokens.some((expected) => {
    if (expected.length !== actual.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected[index] ^ actual[index];
    }
    return difference === 0;
  });
}
