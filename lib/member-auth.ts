import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";

type LineProfile = { userId: string; displayName?:string };
type MemberIdentity = { id: string; memberCode: string };

export async function authenticatedLineProfile(request:NextRequest):Promise<LineProfile|null>{
 const auth=request.headers.get("authorization")??"";
 if(!auth.startsWith("Bearer "))return null;
 const runtime=env as unknown as Record<string,string|undefined>;
 if(runtime.LINE_LOGIN_CHANNEL_ID){const token=auth.slice(7),verify=await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(token)}`,{cache:"no-store"});if(!verify.ok)return null;const details=await verify.json() as {client_id?:string;expires_in?:number};if(details.client_id!==runtime.LINE_LOGIN_CHANNEL_ID||Number(details.expires_in)<=0)return null}
 const response=await fetch("https://api.line.me/v2/profile",{headers:{Authorization:auth},cache:"no-store"});
 if(!response.ok)return null;
 const profile=await response.json() as LineProfile;
 return profile.userId?profile:null;
}
export async function authenticatedLineUserId(request:NextRequest):Promise<string|null>{return (await authenticatedLineProfile(request))?.userId??null}

export async function authenticatedMember(request: NextRequest): Promise<MemberIdentity | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const profile=await authenticatedLineProfile(request);
    if(!profile)return null;
    const member=await env.DB.prepare(
      `SELECT m.id, m.member_code AS memberCode FROM identity_links i JOIN members m ON m.id = i.member_id
       WHERE i.provider = 'LINE' AND i.provider_user_id = ? AND i.revoked_at IS NULL AND m.status = 'ACTIVE' LIMIT 1`,
    ).bind(profile.userId).first<MemberIdentity>();
    if(member&&profile.displayName?.trim())await env.DB.prepare("UPDATE members SET line_display_name=?,updated_at=? WHERE id=? AND COALESCE(line_display_name,'')<>?").bind(profile.displayName.trim().slice(0,120),Date.now(),member.id,profile.displayName.trim().slice(0,120)).run();
    return member;
  }

  const runtime = env as unknown as Record<string, string | undefined>;
  if (request.headers.get("x-compass-preview") === "representative" && runtime.PREVIEW_MEMBER_CODE) {
    return env.DB.prepare(
      `SELECT id, member_code AS memberCode FROM members WHERE member_code = ? AND status = 'ACTIVE' LIMIT 1`,
    ).bind(runtime.PREVIEW_MEMBER_CODE).first<MemberIdentity>();
  }
  return null;
}
