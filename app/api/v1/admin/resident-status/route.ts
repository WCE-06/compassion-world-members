import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";

export async function POST(request:NextRequest){
 const runtime=env as unknown as Record<string,string|undefined>;
 if(!runtime.MEMBER_MIGRATION_KEY||request.headers.get("x-compass-migration-key")!==runtime.MEMBER_MIGRATION_KEY)return NextResponse.json({error:"FORBIDDEN"},{status:403});
 const body=await request.json().catch(()=>null) as {memberCode?:string;active?:boolean;checkedAt?:number}|null;
 const memberCode=(body?.memberCode??"").trim().toUpperCase();
 if(!/^[A-Z0-9]{10}$/.test(memberCode)||typeof body?.active!=="boolean")return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
 const checkedAt=Number.isFinite(body.checkedAt)?Number(body.checkedAt):Date.now();
 const result=await env.DB.prepare(`UPDATE members SET resident_status=?,resident_checked_at=?,updated_at=? WHERE member_code=? AND status='ACTIVE'`).bind(body.active?"ACTIVE":"INACTIVE",checkedAt,Date.now(),memberCode).run();
 if(!result.meta.changes)return NextResponse.json({error:"MEMBER_NOT_FOUND"},{status:404});
 return NextResponse.json({ok:true,memberCode,residentStatus:body.active?"ACTIVE":"INACTIVE",checkedAt});
}
