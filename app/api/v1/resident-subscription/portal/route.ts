import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { authenticatedLiveMember as authenticatedMember } from "@/lib/member-auth";
import { stripeRequest } from "@/lib/stripe";
type Portal={url:string};
export async function POST(request:NextRequest){const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"MEMBER_LOGIN_REQUIRED"},{status:401});const customer=await env.DB.prepare("SELECT stripe_customer_id AS id FROM stripe_customers WHERE member_id=? LIMIT 1").bind(member.id).first<{id:string}>();if(!customer)return NextResponse.json({error:"STRIPE_CUSTOMER_NOT_FOUND"},{status:404});const base=((env as unknown as Record<string,string|undefined>).MEMBERS_CANONICAL_BASE_URL??request.nextUrl.origin).replace(/\/$/,"");try{const portal=await stripeRequest<Portal>("/billing_portal/sessions","POST",new URLSearchParams({customer:customer.id,return_url:`${base}/resident`}));return NextResponse.json({portalUrl:portal.url},{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({error:"PORTAL_UNAVAILABLE",message:"契約内容を開けませんでした。時間を置いてもう一度お試しください。"},{status:502})}}
