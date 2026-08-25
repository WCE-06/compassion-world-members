import { NextRequest, NextResponse } from "next/server";
import { bookingDateRange, isBookableDate } from "@/lib/booking-window";
import { facilityPost, filterOwnedFacilityRows, isOwnedFacilityRow } from "@/lib/facility-api";
import { authenticatedMember } from "@/lib/member-auth";

type FacilityReservation={reservationId:string;memberCode:string;facilityId:string;startAt:string;endAt:string;status:"CONFIRMED"|"CANCELLED"|"COMPLETED"};

export async function GET(request: NextRequest) {
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) return NextResponse.json({ error: "LINE_AUTH_REQUIRED" }, { status: 401 });
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  try {
    const rows = await facilityPost<FacilityReservation[]>("reservation.get", { facilityId: "FEBBRAIO", memberCode: member.memberCode });
    const ownedRows = filterOwnedFacilityRows(rows, member.memberCode);
    return NextResponse.json({ reservations: ownedRows.map(row => ({ id: row.reservationId, studioId: row.facilityId, startsAt: Date.parse(row.startAt), endsAt: Date.parse(row.endAt), status: row.status })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "FACILITY_API_ERROR" }, { status: 502 }); }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) return NextResponse.json({ error: "LINE_AUTH_REQUIRED" }, { status: 401 });
  const member = await authenticatedMember(request);
  if (!member) return NextResponse.json({ error: "MEMBER_LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { startAt?: string; durationHours?: number; requestId?: string } | null;
  const parsedStart=Date.parse(body?.startAt??""),duration=Number(body?.durationHours),date=Number.isFinite(parsedStart)?new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(parsedStart):"",minute=Number.isFinite(parsedStart)?Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",minute:"2-digit",hour12:false}).format(parsedStart)):NaN;
  if(!isBookableDate(date)||!Number.isInteger(minute)||minute%15!==0||!Number.isInteger(duration)||duration<1||duration>10)return NextResponse.json({error:"INVALID_RESERVATION_WINDOW",...bookingDateRange()},{status:400});
  const startAt=new Date(parsedStart).toISOString();
  try {
    const row=await facilityPost<FacilityReservation>("reservation.create",{facilityId:"FEBBRAIO",memberCode:member.memberCode,startAt,hours:duration},body?.requestId||crypto.randomUUID());
    if(!isOwnedFacilityRow(row,member.memberCode))throw new Error("RESERVATION_OWNERSHIP_MISMATCH");
    return NextResponse.json({reservationId:row.reservationId,startsAt:Date.parse(row.startAt),endsAt:Date.parse(row.endAt),status:row.status},{status:201});
  } catch(error){const code=error instanceof Error?error.message:"FACILITY_API_ERROR";return NextResponse.json({error:code},{status:code==="TIME_NOT_AVAILABLE"?409:502});}
}
