import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { authenticatedLineUserId } from "@/lib/member-auth";
import { PRIVACY_VERSION,TERMS_VERSION,validateRegistration } from "@/lib/member-registration";

async function randomMemberCode(){for(let attempt=0;attempt<12;attempt++){const bytes=crypto.getRandomValues(new Uint8Array(10)),alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",code=Array.from(bytes,value=>alphabet[value%alphabet.length]).join("");const exists=await env.DB.prepare("SELECT 1 FROM members WHERE member_code=? LIMIT 1").bind(code).first();if(!exists)return code}throw new Error("MEMBER_CODE_GENERATION_FAILED")}

export async function POST(request:NextRequest){
 const lineUserId=await authenticatedLineUserId(request);if(!lineUserId)return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const linked=await env.DB.prepare(`SELECT m.member_code AS memberCode FROM identity_links i JOIN members m ON m.id=i.member_id WHERE i.provider='LINE' AND i.provider_user_id=? AND i.revoked_at IS NULL LIMIT 1`).bind(lineUserId).first<{memberCode:string}>();
 if(linked)return NextResponse.json({memberCode:linked.memberCode,resumed:true},{status:200});
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null,checked=validateRegistration(body);
 if(!checked.ok)return NextResponse.json({error:"INVALID_REGISTRATION",fields:checked.errors},{status:400});
 const {displayName,phone,birthDate,postalCode,address,email,acceptedTerms}=checked.data;
 const duplicate=await env.DB.prepare(`SELECT member_code AS memberCode FROM members WHERE REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'　','')=? AND status='ACTIVE' LIMIT 1`).bind(phone).first<{memberCode:string}>();
 if(duplicate)return NextResponse.json({error:"PHONE_ALREADY_REGISTERED",message:"この電話番号は登録済みです。以前の会員番号をお持ちの方から移行してください"},{status:409});
 const code=await randomMemberCode(),id=crypto.randomUUID(),now=Date.now(),eventId=crypto.randomUUID(),acceptanceId=crypto.randomUUID();
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO members (id,member_code,display_name,phone,email,birth_date,postal_code,address,points_balance,member_rank,status,source_system,source_customer_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,0,'STANDARD','ACTIVE','NEW_CARD',NULL,?,?)`).bind(id,code,displayName,phone,email||null,birthDate,postalCode,address,now,now),
  env.DB.prepare("INSERT INTO identity_links (id,member_id,provider,provider_user_id,linked_at,revoked_at) VALUES (?,?,'LINE',?,?,NULL)").bind(`line:${lineUserId}`,id,lineUserId,now),
  env.DB.prepare("INSERT INTO member_registration_syncs (member_id,status,attempts,source_customer_id,last_error,last_request_id,synced_at,updated_at) VALUES (?,'PENDING',0,NULL,NULL,NULL,NULL,?)").bind(id,now),
  env.DB.prepare("INSERT INTO member_terms_acceptances (id,member_id,terms_version,privacy_version,accepted_at,user_agent) VALUES (?,?,?,?,?,?)").bind(acceptanceId,id,TERMS_VERSION,PRIVACY_VERSION,now,(request.headers.get("user-agent")??"").slice(0,300)||null),
  env.DB.prepare("INSERT INTO member_registration_events (id,member_id,event_type,actor,details_json,created_at) VALUES (?,?,'LOCAL_MEMBER_CREATED','MEMBER',?,?)").bind(eventId,id,JSON.stringify({memberCode:code,acceptedTerms,termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION}),now),
  env.DB.prepare("UPDATE legacy_member_imports SET status='MIGRATED',migrated_member_id=? WHERE line_user_id=?").bind(id,lineUserId),
 ]);
 return NextResponse.json({memberCode:code,smaregiSyncStatus:"PENDING"},{status:201});
}
