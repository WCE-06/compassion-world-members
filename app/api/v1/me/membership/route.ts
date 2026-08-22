import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedLineUserId, authenticatedMember } from "@/lib/member-auth";
import { facilityPost } from "@/lib/facility-api";

export async function GET(request: NextRequest) {
  const identity = await authenticatedMember(request);
  if (!identity) {const lineUserId=await authenticatedLineUserId(request);if(!lineUserId)return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});const staged=await env.DB.prepare("SELECT id FROM legacy_member_imports WHERE line_user_id=? AND status='UNREGISTERED' LIMIT 1").bind(lineUserId).first();return NextResponse.json({error:staged?"REGISTRATION_REQUIRED":"MEMBERSHIP_NOT_LINKED"},{status:staged?422:404})}
  const member = await env.DB.prepare(`SELECT id, member_code AS memberCode, display_name AS displayName, member_rank AS memberRank, points_balance AS pointsBalance FROM members WHERE id = ? AND status = 'ACTIVE'`).bind(identity.id).first<{id:string;memberCode:string;displayName:string;memberRank:string|null;pointsBalance:number}>();
  if (!member) return NextResponse.json({ error: "MEMBERSHIP_NOT_LINKED" }, { status: 404 });
  const reservations = await facilityPost<{reservationId:string;startAt:string;endAt:string;status:string}[]>("reservation.get", { facilityId:"FEBBRAIO", memberCode:member.memberCode }).catch(()=>[]);
  const reservation = reservations.filter(row=>row.status==="CONFIRMED"&&Date.parse(row.startAt)>Date.now()).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt))[0];
  const sessionResult = await facilityPost<{found:boolean;session?:{checkedInAt:number|null;scheduledEndAt:string;status:string;paymentStatus:string;billingAmount:number|null}}>("facility.session.get", { facilityId:"FEBBRAIO", memberCode:member.memberCode }).catch(()=>({found:false}));
  const session=sessionResult.found?sessionResult.session:null;
  const order = await env.DB.prepare(`SELECT o.order_number AS orderNumber,o.status,(SELECT call_number FROM order_fulfillments WHERE order_id=o.id AND department='FOOD') AS foodCallNumber,(SELECT call_number FROM order_fulfillments WHERE order_id=o.id AND department='DRINK') AS drinkCallNumber FROM orders o WHERE o.member_id = ? AND o.status IN ('WAITING_STORE_PAYMENT','PAID','ACCEPTED','COOKING','READY') ORDER BY o.created_at DESC LIMIT 1`).bind(member.id).first<{orderNumber:string;status:string;foodCallNumber:number|null;drinkCallNumber:number|null}>();
  const orderStatus:Record<string,string>={WAITING_STORE_PAYMENT:"WAITING_PAYMENT",PAID:"ACCEPTED",ACCEPTED:"ACCEPTED",COOKING:"COOKING",READY:"READY"};
  return NextResponse.json({memberId:member.id,memberCode:member.memberCode,displayName:member.displayName,points:member.pointsBalance,rank:member.memberRank??"STANDARD",nextReservation:reservation?{facilityName:"Music Studio FEBBRAIO",startsAt:reservation.startAt,endsAt:reservation.endAt}:null,session:session?{facilityName:"Music Studio FEBBRAIO",status:session.status==="ACTIVE"?"IN_USE":session.status,paymentStatus:session.paymentStatus,startedAt:session.checkedInAt?new Date(session.checkedInAt).toISOString():undefined,scheduledEndsAt:session.scheduledEndAt||undefined,unpaidAmount:session.billingAmount}:null,activeOrder:order?{orderNumber:order.orderNumber,foodCallNumber:order.foodCallNumber,drinkCallNumber:order.drinkCallNumber,status:orderStatus[order.status]}:null,notices:[]});
}
