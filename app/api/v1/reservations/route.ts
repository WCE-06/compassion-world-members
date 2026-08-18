import { NextRequest, NextResponse } from "next/server";
import { bookingDateRange, isBookableDate } from "@/lib/booking-window";
import { facilityPost } from "@/lib/facility-api";
import { authenticatedMember } from "@/lib/member-auth";

type FacilityReservation={reservationId:string;facilityId:string;startAt:string;endAt:string;status:"CONFIRMED"|"CANCELLED"|"COMPLETED"};

export async function GET(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  try {
    const rows = await facilityPost<FacilityReservation[]>("reservation.get", { facilityId: "FEBBRAIO", memberCode: member.memberCode });
    return NextResponse.json({ reservations: rows.map(row => ({ id: row.reservationId, studioId: row.facilityId, startsAt: Date.parse(row.startAt), endsAt: Date.parse(row.endAt), status: row.status })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "FACILITY_API_ERROR" }, { status: 502 }); }
}

export async function POST(request: NextRequest) {
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { date?: string; startHour?: number; durationHours?: number; requestId?: string } | null;
  const date=body?.date??"",startHour=Number(body?.startHour),duration=Number(body?.durationHours);
  if(!isBookableDate(date)||!Number.isInteger(startHour)||startHour<8||startHour>25||!Number.isInteger(duration)||duration<1||duration>10||startHour+duration>26)return NextResponse.json({error:"INVALID_RESERVATION_WINDOW",...bookingDateRange()},{status:400});
  const base=new Date(`${date}T12:00:00+09:00`);if(startHour>=24)base.setDate(base.getDate()+1);const localDate=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(base);const actualHour=startHour>=24?startHour-24:startHour;const startAt=`${localDate}T${String(actualHour).padStart(2,"0")}:00:00+09:00`;
  try {
    const row=await facilityPost<FacilityReservation>("reservation.create",{facilityId:"FEBBRAIO",memberCode:member.memberCode,startAt,hours:duration},body?.requestId||crypto.randomUUID());
    return NextResponse.json({reservationId:row.reservationId,startsAt:Date.parse(row.startAt),endsAt:Date.parse(row.endAt),status:row.status},{status:201});
  } catch(error){const code=error instanceof Error?error.message:"FACILITY_API_ERROR";return NextResponse.json({error:code},{status:code==="TIME_NOT_AVAILABLE"?409:502});}
}
