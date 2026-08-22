import { NextRequest, NextResponse } from "next/server";
import { facilityPost, filterOwnedFacilityRows } from "@/lib/facility-api";
import { authenticatedMember } from "@/lib/member-auth";

export async function DELETE(request:NextRequest,context:{params:Promise<{id:string}>}){
 if(!request.headers.get("authorization")?.startsWith("Bearer "))return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"MEMBER_LOGIN_REQUIRED"},{status:401});
 const {id}=await context.params;
 try{
  const rows=await facilityPost<{reservationId:string;memberCode:string}[]>("reservation.get",{facilityId:"FEBBRAIO",memberCode:member.memberCode});
  const owned=filterOwnedFacilityRows(rows,member.memberCode);
  if(!owned.some(row=>row.reservationId===id))return NextResponse.json({error:"RESERVATION_NOT_FOUND"},{status:404});
  const row=await facilityPost<{reservationId:string;status:string}>("reservation.cancel",{facilityId:"FEBBRAIO",reservationId:id,memberCode:member.memberCode});return NextResponse.json(row);
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"FACILITY_API_ERROR"},{status:502})}
}
