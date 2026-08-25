import {env} from "cloudflare:workers";
import {NextRequest,NextResponse} from "next/server";
import {createAdminPasswordRecord,requireAdminSession,verifyAdminPassword} from "@/lib/admin-session";

export async function POST(request:NextRequest){
 const email=await requireAdminSession(request);if(!email)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const body=await request.json().catch(()=>null) as {currentPassword?:string;newPassword?:string;confirmation?:string}|null,current=String(body?.currentPassword??""),next=String(body?.newPassword??"");
 if(next!==String(body?.confirmation??"")||!/^(?=.*[A-Za-z])(?=.*[0-9])[\x21-\x7E]{10,128}$/.test(next))return NextResponse.json({error:"PASSWORD_POLICY"},{status:400});
 if(current===next)return NextResponse.json({error:"PASSWORD_REUSED"},{status:400});
 const startedAt=Date.now(),[currentValid,record]=await Promise.all([verifyAdminPassword(email,current),createAdminPasswordRecord(next)]);
 if(!currentValid)return NextResponse.json({error:"CURRENT_PASSWORD_INVALID"},{status:401,headers:{"Server-Timing":`password;dur=${Date.now()-startedAt}`}});
 const now=Date.now();
 await env.DB.batch([env.DB.prepare("INSERT INTO admin_accounts (email,password_scheme,password_salt,password_hash,password_changed_at,updated_by) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET password_scheme=excluded.password_scheme,password_salt=excluded.password_salt,password_hash=excluded.password_hash,password_changed_at=excluded.password_changed_at,updated_by=excluded.updated_by").bind(email,record.scheme,record.salt,record.hash,now,email),env.DB.prepare("INSERT INTO member_registration_events (id,member_id,event_type,actor,details_json,created_at) VALUES (?,NULL,'ADMIN_PASSWORD_CHANGED',?,'{}',?)").bind(crypto.randomUUID(),email,now)]);
 return NextResponse.json({ok:true,changedAt:now},{headers:{"Server-Timing":`password;dur=${Date.now()-startedAt}`}});
}
