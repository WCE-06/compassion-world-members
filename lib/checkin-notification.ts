import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function requireCheckinNotificationToken(request: NextRequest) {
  const runtime = env as unknown as { CHECKIN_NOTIFICATION_API_TOKEN?: string; CHECKIN_POINT_API_TOKEN?: string };
  const configured = [runtime.CHECKIN_NOTIFICATION_API_TOKEN, runtime.CHECKIN_POINT_API_TOKEN]
    .map(value => value?.trim() ?? "")
    .filter(Boolean);
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!configured.length || !supplied) return false;
  const [actual, ...expected] = await Promise.all([digest(supplied), ...configured.map(digest)]);
  return expected.some(candidate => {
    if (candidate.length !== actual.length) return false;
    let difference = 0;
    for (let index = 0; index < candidate.length; index += 1) difference |= candidate[index] ^ actual[index];
    return difference === 0;
  });
}

