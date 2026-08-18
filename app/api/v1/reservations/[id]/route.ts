import { NextRequest, NextResponse } from "next/server";
import { facilityPost } from "@/lib/facility-api";
import { authenticatedMember } from "@/lib/member-auth";

export async function DELETE(request:NextRequest,context:{params:Promise<{id:string}>}){
 const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"MEMBER_LOGIN_REQUIRED"},{status:401});
 const {id}=await context.params;
 try{
  const owned=await facilityPost<{reservationId:string}[]>("reservation.get",{facilityId:"FEBBRAIO",memberCode:member.memberCode});
  if(!owned.some(row=>row.reservationId===id))return NextResponse.json({error:"RESERVATION_NOT_FOUND"},{status:404});
  const row=await facilityPost<{reservationId:string;status:string}>("reservation.cancel",{reservationId:id});return NextResponse.json(row);
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"FACILITY_API_ERROR"},{status:502})}
}
