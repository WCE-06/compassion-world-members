import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";

const PURPOSE="FEBBRAIO_RESERVATION",TOKEN_LIFETIME_MS=5*60*1000;
const encoder=new TextEncoder();
function base64url(bytes:Uint8Array){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}

export async function POST(request:NextRequest){
 if(!request.headers.get("authorization")?.startsWith("Bearer "))return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"MEMBER_LOGIN_REQUIRED"},{status:401});
 const runtime=env as unknown as Record<string,string|undefined>,secret=runtime.FEBBRAIO_RESERVATION_SIGNING_SECRET??"",exchangeUrl=runtime.FEBBRAIO_RESERVATION_EXCHANGE_URL??"";
 if(secret.length<32||!exchangeUrl)return NextResponse.json({error:"FEBBRAIO_CONNECTION_NOT_CONFIGURED",message:"予約サイトとの接続を準備できませんでした"},{status:503});
 const memberCode=member.memberCode.trim().toUpperCase();if(!/^[A-Z0-9]{10}$/.test(memberCode))return NextResponse.json({error:"INVALID_MEMBER_CODE"},{status:400});
 const issuedAt=Date.now(),payload={purpose:PURPOSE,memberId:member.id,memberCode,issuedAt,expiresAt:issuedAt+TOKEN_LIFETIME_MS},payloadPart=base64url(encoder.encode(JSON.stringify(payload)));
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]),signature=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(payloadPart)));
 return NextResponse.json({token:`${payloadPart}.${base64url(signature)}`,exchangeUrl,expiresAt:payload.expiresAt},{headers:{"Cache-Control":"no-store"}});
}
