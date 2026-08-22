import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { importedResidentStatus } from "@/lib/member-rank";

type ImportRow={sourceRow:number;memberCode?:string;lineUserId?:string;displayName?:string;displayNameKana?:string;phone?:string;email?:string;birthDate?:string;gender?:string;postalCode?:string;prefecture?:string;address?:string;points?:number;rank?:string;registeredAt?:string};
const clean=(value:unknown,max=240)=>typeof value==="string"?value.trim().slice(0,max):"";
const memberCode=(value:unknown)=>clean(value,10).toUpperCase();

export async function POST(request:NextRequest){
 const runtime=env as unknown as Record<string,string|undefined>;
 const supplied=request.headers.get("x-compass-migration-key")??"";
 if(!runtime.MEMBER_MIGRATION_KEY||supplied!==runtime.MEMBER_MIGRATION_KEY)return NextResponse.json({error:"FORBIDDEN"},{status:403});
 const body=await request.json().catch(()=>null) as {rows?:ImportRow[]}|null;
 if(!Array.isArray(body?.rows)||body.rows.length<1||body.rows.length>50)return NextResponse.json({error:"INVALID_BATCH"},{status:400});
 const unknownRanks=body.rows.map(row=>clean(row.rank,40)).filter(rank=>rank&&importedResidentStatus(rank)===null);
 if(unknownRanks.length)return NextResponse.json({error:"UNKNOWN_MEMBERSHIP_TYPE",values:[...new Set(unknownRanks)]},{status:400});
 const now=Date.now();let registered=0,unregistered=0,skipped=0;
 for(const row of body.rows){
  const code=memberCode(row.memberCode),lineUserId=clean(row.lineUserId,80);
  if(code&&/^[A-Z0-9]{10}$/.test(code)){
   const id=`legacy:${code}`;
   await env.DB.batch([
    env.DB.prepare(`INSERT INTO members (id,member_code,display_name,display_name_kana,phone,email,birth_date,gender,postal_code,prefecture,address,points_balance,member_rank,resident_status,resident_checked_at,status,source_system,source_customer_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE','L_MEMBERS',?,?,?)
      ON CONFLICT(member_code) DO UPDATE SET display_name=excluded.display_name,display_name_kana=excluded.display_name_kana,phone=excluded.phone,email=excluded.email,birth_date=excluded.birth_date,gender=excluded.gender,postal_code=excluded.postal_code,prefecture=excluded.prefecture,address=excluded.address,points_balance=excluded.points_balance,resident_status=excluded.resident_status,resident_checked_at=excluded.resident_checked_at,updated_at=excluded.updated_at`)
      .bind(id,code,clean(row.displayName,120)||"名称未登録",clean(row.displayNameKana,120)||null,clean(row.phone,40)||null,clean(row.email,160)||null,clean(row.birthDate,20)||null,clean(row.gender,20)||null,clean(row.postalCode,16)||null,clean(row.prefecture,40)||null,clean(row.address,240)||null,Math.max(0,Number(row.points)||0),"STANDARD",importedResidentStatus(row.rank)??"UNKNOWN",now,code,now,now),
    ...(lineUserId?[env.DB.prepare(`INSERT INTO identity_links (id,member_id,provider,provider_user_id,linked_at,revoked_at) VALUES (?,(SELECT id FROM members WHERE member_code=?),'LINE',?,?,NULL)
      ON CONFLICT(provider,provider_user_id) DO UPDATE SET member_id=excluded.member_id,linked_at=excluded.linked_at,revoked_at=NULL`).bind(`line:${lineUserId}`,code,lineUserId,now)]:[]),
   ]);registered++;
  }else if(lineUserId){
   await env.DB.prepare(`INSERT INTO legacy_member_imports (id,line_user_id,display_name,display_name_kana,phone,email,birth_date,gender,postal_code,prefecture,address,source_registered_at,status,imported_at,migrated_member_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'UNREGISTERED',?,NULL)
    ON CONFLICT(line_user_id) DO UPDATE SET display_name=excluded.display_name,display_name_kana=excluded.display_name_kana,phone=excluded.phone,email=excluded.email,birth_date=excluded.birth_date,gender=excluded.gender,postal_code=excluded.postal_code,prefecture=excluded.prefecture,address=excluded.address,source_registered_at=excluded.source_registered_at,imported_at=excluded.imported_at`)
    .bind(`legacy-line:${lineUserId}`,lineUserId,clean(row.displayName,120)||null,clean(row.displayNameKana,120)||null,clean(row.phone,40)||null,clean(row.email,160)||null,clean(row.birthDate,20)||null,clean(row.gender,20)||null,clean(row.postalCode,16)||null,clean(row.prefecture,40)||null,clean(row.address,240)||null,clean(row.registeredAt,40)||null,now).run();unregistered++;
  }else skipped++;
 }
 return NextResponse.json({registered,unregistered,skipped,total:body.rows.length});
}
