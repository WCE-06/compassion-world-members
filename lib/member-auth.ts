import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";

type LineProfile = { userId: string };
type MemberIdentity = { id: string; memberCode: string };

export async function authenticatedMember(request: NextRequest): Promise<MemberIdentity | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const response = await fetch("https://api.line.me/v2/profile", { headers: { Authorization: auth }, cache: "no-store" });
    if (!response.ok) return null;
    const profile = await response.json() as LineProfile;
    return env.DB.prepare(
      `SELECT m.id, m.member_code AS memberCode FROM identity_links i JOIN members m ON m.id = i.member_id
       WHERE i.provider = 'LINE' AND i.provider_user_id = ? AND i.revoked_at IS NULL AND m.status = 'ACTIVE' LIMIT 1`,
    ).bind(profile.userId).first<MemberIdentity>();
  }

  const runtime = env as unknown as Record<string, string | undefined>;
  if (request.headers.get("x-compass-preview") === "representative" && runtime.PREVIEW_MEMBER_CODE) {
    return env.DB.prepare(
      `SELECT id, member_code AS memberCode FROM members WHERE member_code = ? AND status = 'ACTIVE' LIMIT 1`,
    ).bind(runtime.PREVIEW_MEMBER_CODE).first<MemberIdentity>();
  }
  return null;
}
