import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";

export async function GET(request: NextRequest) {
  const identity = await authenticatedMember(request);
  if (!identity) return NextResponse.json({ error: "MEMBERSHIP_NOT_LINKED" }, { status: 404 });
  const member = await env.DB.prepare(`SELECT id, member_code AS memberCode, display_name AS displayName, member_rank AS memberRank FROM members WHERE id = ? AND status = 'ACTIVE'`).bind(identity.id).first<{id:string;memberCode:string;displayName:string;memberRank:string|null}>();
  if (!member) return NextResponse.json({ error: "MEMBERSHIP_NOT_LINKED" }, { status: 404 });
  const reservation = await env.DB.prepare(`SELECT starts_at AS startsAt, ends_at AS endsAt FROM reservations WHERE member_id = ? AND status = 'CONFIRMED' AND starts_at > ? ORDER BY starts_at LIMIT 1`).bind(member.id,Date.now()).first<{startsAt:number;endsAt:number}>();
  const session = await env.DB.prepare(`SELECT checked_in_at AS startedAt, scheduled_ends_at AS scheduledEndsAt, status, payment_status AS paymentStatus, total_including_tax AS unpaidAmount FROM studio_sessions WHERE member_id = ? AND status = 'IN_USE' ORDER BY updated_at DESC LIMIT 1`).bind(member.id).first<{startedAt:number|null;scheduledEndsAt:number|null;status:string;paymentStatus:string;unpaidAmount:number|null}>();
  const order = await env.DB.prepare(`SELECT order_number AS orderNumber, status FROM orders WHERE member_id = ? AND status IN ('WAITING_STORE_PAYMENT','PAID','ACCEPTED','COOKING','READY') ORDER BY created_at DESC LIMIT 1`).bind(member.id).first<{orderNumber:string;status:string}>();
  const orderStatus:Record<string,string>={WAITING_STORE_PAYMENT:"WAITING_PAYMENT",PAID:"ACCEPTED",ACCEPTED:"ACCEPTED",COOKING:"COOKING",READY:"READY"};
  return NextResponse.json({memberId:member.id,memberCode:member.memberCode,displayName:member.displayName,points:0,rank:member.memberRank??"STANDARD",nextReservation:reservation?{facilityName:"Music Studio FEBBRAIO",startsAt:new Date(reservation.startsAt).toISOString(),endsAt:new Date(reservation.endsAt).toISOString()}:null,session:session?{facilityName:"Music Studio FEBBRAIO",status:session.status,paymentStatus:session.paymentStatus,startedAt:session.startedAt?new Date(session.startedAt).toISOString():undefined,scheduledEndsAt:session.scheduledEndsAt?new Date(session.scheduledEndsAt).toISOString():undefined,unpaidAmount:session.unpaidAmount}:null,activeOrder:order?{orderNumber:order.orderNumber,status:orderStatus[order.status]}:null,notices:[]});
}
