import { NextRequest, NextResponse } from "next/server";
import { bookingDateRange, isBookableDate } from "@/lib/booking-window";
import { facilityPublicGet } from "@/lib/facility-api";

type FacilityDay = { date:string; opensAt:string; closesAt:string; slots:{startAt:string;label:string;available:boolean}[] };

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!isBookableDate(date)) return NextResponse.json({ error: "INVALID_DATE", ...bookingDateRange() }, { status: 400 });
  try {
    const result = await facilityPublicGet<FacilityDay>("reservation.dayAvailability", { facilityId: "FEBBRAIO", date });
    const slots = result.slots.map(slot => ({ startAt: Date.parse(slot.startAt), label: slot.label, available: slot.available }));
    return NextResponse.json({ date: result.date, opensAt: Date.parse(result.opensAt), closesAt: Date.parse(result.closesAt), slots, source: "COMMON_FACILITY_GAS", ...bookingDateRange() }, { headers: { "Cache-Control": "public, max-age=20" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "FACILITY_API_ERROR" }, { status: 502 });
  }
}
