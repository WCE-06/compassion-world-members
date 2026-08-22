import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { authenticatedLineUserId } from "@/lib/member-auth";

export async function GET(request:NextRequest){
 const lineUserId=await authenticatedLineUserId(request);if(!lineUserId)return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const row=await env.DB.prepare(`SELECT display_name AS displayName,phone,email,birth_date AS birthDate,postal_code AS postalCode,prefecture,address FROM legacy_member_imports WHERE line_user_id=? AND status='UNREGISTERED' LIMIT 1`).bind(lineUserId).first<Record<string,string|null>>();
 return NextResponse.json({registration:row??{}},{headers:{"Cache-Control":"no-store"}});
}
