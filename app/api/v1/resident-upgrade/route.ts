import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";

export async function POST(request:NextRequest){
 if(!request.headers.get("authorization")?.startsWith("Bearer "))return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"MEMBER_LOGIN_REQUIRED"},{status:401});
 const runtime=env as unknown as Record<string,string|undefined>,configured=runtime.RESIDENT_SUBSCRIPTION_CHECKOUT_URL??"";
 if(!configured)return NextResponse.json({error:"RESIDENT_SUBSCRIPTION_NOT_CONFIGURED",message:"住民登録のお申し込みは現在準備中です。受付スタッフへお声がけください。"},{status:503});
 const url=new URL(configured);url.searchParams.set("client_reference_id",member.id);
 return NextResponse.json({checkoutUrl:url.toString()},{headers:{"Cache-Control":"no-store"}});
}
