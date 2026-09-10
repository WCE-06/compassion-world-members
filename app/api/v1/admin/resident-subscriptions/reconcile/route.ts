import { NextRequest,NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { reconcileAllResidentSubscriptions } from "@/lib/resident-subscription";

export async function POST(request:NextRequest){
  const actor=await requireAdminSession(request);
  if(!actor)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  const results=await reconcileAllResidentSubscriptions();
  const failed=results.filter(row=>!row.updated),active=results.filter(row=>["active","trialing"].includes(row.status)).length;
  return NextResponse.json({ok:failed.length===0,checked:results.length,active,failed:failed.length,results},{headers:{"Cache-Control":"no-store"}});
}
