import { NextResponse } from "next/server";
import { bookingDateRange } from "@/lib/booking-window";
export async function GET(){return NextResponse.json(bookingDateRange(),{headers:{"Cache-Control":"public, max-age=300"}})}
