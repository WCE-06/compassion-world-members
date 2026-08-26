import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { requirePosToken } from "@/lib/pos-api";
import { expireStaleLocks,expireStaleOrder,orderDetails,PosOrderRow } from "@/lib/order-pos";

export async function GET(request:NextRequest){
 if(!await requirePosToken(request))return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});
 const memberCode=(request.nextUrl.searchParams.get("memberCode")??"").normalize("NFKC").trim().toUpperCase();if(!/^[A-Z0-9]{10}$/.test(memberCode))return NextResponse.json({ok:false,error:"MEMBER_NOT_FOUND"},{status:404,headers:{"Cache-Control":"private, no-store, max-age=0"}});
 const member=await env.DB.prepare(`SELECT id FROM members WHERE member_code=? AND status='ACTIVE'`).bind(memberCode).first<{id:string}>();if(!member)return NextResponse.json({ok:false,error:"MEMBER_NOT_FOUND"},{status:404,headers:{"Cache-Control":"private, no-store, max-age=0"}});
 await expireStaleLocks();await expireStaleOrder();
 const queriedAt=Date.now();
 const rows=await env.DB.prepare(`SELECT o.id,o.order_number AS orderNumber,m.member_code AS memberCode,o.status,o.payment_method AS paymentMethod,o.created_at AS createdAt,o.expires_at AS expiresAt,o.pickup_at AS pickupRequestedAt,o.total_including_tax AS totalIncludingTax,o.smaregi_transaction_id AS smaregiTransactionId FROM orders o JOIN members m ON m.id=o.member_id WHERE o.member_id=? AND o.payment_method='STORE' AND o.status IN ('WAITING_STORE_PAYMENT','PAYMENT_PROCESSING') AND o.expires_at>? ORDER BY o.created_at`).bind(member.id,queriedAt).all<PosOrderRow>();
 return NextResponse.json({ok:true,memberCode,queriedAt:new Date(queriedAt).toISOString(),orders:await Promise.all(rows.results.map(orderDetails))},{headers:{"Cache-Control":"private, no-store, max-age=0","CDN-Cache-Control":"no-store"}});
}
