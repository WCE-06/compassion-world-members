import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { authenticatedLineUserId } from "@/lib/member-auth";

const clean=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";
async function randomMemberCode(){for(let attempt=0;attempt<12;attempt++){const bytes=crypto.getRandomValues(new Uint8Array(10)),alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",code=Array.from(bytes,value=>alphabet[value%alphabet.length]).join("");const exists=await env.DB.prepare("SELECT 1 FROM members WHERE member_code=? LIMIT 1").bind(code).first();if(!exists)return code}throw new Error("MEMBER_CODE_GENERATION_FAILED")}

export async function POST(request:NextRequest){
 const lineUserId=await authenticatedLineUserId(request);if(!lineUserId)return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const existing=await env.DB.prepare("SELECT 1 FROM identity_links WHERE provider='LINE' AND provider_user_id=? AND revoked_at IS NULL LIMIT 1").bind(lineUserId).first();if(existing)return NextResponse.json({error:"ALREADY_REGISTERED"},{status:409});
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;const displayName=clean(body?.displayName,120),phone=clean(body?.phone,40),birthDate=clean(body?.birthDate,20),postalCode=clean(body?.postalCode,16),address=clean(body?.address,240),email=clean(body?.email,160);
 if(!displayName||!phone||!birthDate||!postalCode||!address||body?.acceptedTerms!==true)return NextResponse.json({error:"REQUIRED_FIELDS_MISSING"},{status:400});
 const code=await randomMemberCode(),id=crypto.randomUUID(),now=Date.now();
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO members (id,member_code,display_name,phone,email,birth_date,postal_code,address,points_balance,member_rank,status,source_system,source_customer_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,0,'STANDARD','ACTIVE','NEW_CARD',NULL,?,?)`).bind(id,code,displayName,phone,email||null,birthDate,postalCode,address,now,now),
  env.DB.prepare("INSERT INTO identity_links (id,member_id,provider,provider_user_id,linked_at,revoked_at) VALUES (?,?,'LINE',?,?,NULL)").bind(`line:${lineUserId}`,id,lineUserId,now),
  env.DB.prepare("UPDATE legacy_member_imports SET status='MIGRATED',migrated_member_id=? WHERE line_user_id=?").bind(id,lineUserId),
 ]);
 return NextResponse.json({memberCode:code},{status:201});
}
