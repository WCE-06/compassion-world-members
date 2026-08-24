import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { facilityPost,filterOwnedFacilityRows,isOwnedFacilityRow } from "@/lib/facility-api";

type Reservation={reservationId:string;memberCode:string;facilityId:string;startAt:string;endAt:string;status:string};
type Session={sessionId:string;memberCode:string;facilityId:string;reservationId:string;status:string;checkedInAt:number|null;billingStartAt:string;scheduledEndAt:string;paymentStatus:string;billingAmount:number|null};
type WalkIn={available:boolean;maxHours:number;nextReservationAt:string;nextReservationLabel:string;bufferMinutes:number;rateOptions:{hours:number;amount:number;available:boolean}[]};

function adminEmail(request:NextRequest){const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase(),allowed=((env as unknown as Record<string,string|undefined>).ADMIN_EMAILS??"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean);return email&&allowed.includes(email)?email:null}
function codeOf(value:unknown){return String(value??"").trim().toUpperCase()}

export async function GET(request:NextRequest){
 if(!adminEmail(request))return NextResponse.json({error:"FORBIDDEN"},{status:403});
 const memberCode=codeOf(request.nextUrl.searchParams.get("memberCode"));
 if(!/^[A-Z0-9]{10}$/.test(memberCode))return NextResponse.json({error:"INVALID_MEMBER_CODE"},{status:400});
 const member=await env.DB.prepare(`SELECT id,member_code AS memberCode,display_name AS displayName,phone,status,member_rank AS memberRank,resident_status AS residentStatus FROM members WHERE member_code=? LIMIT 1`).bind(memberCode).first<{id:string;memberCode:string;displayName:string;phone:string|null;status:string;memberRank:string|null;residentStatus:string}>();
 if(!member||member.status!=="ACTIVE")return NextResponse.json({error:"MEMBER_NOT_FOUND"},{status:404});
 const [reservationResult,sessionResult,walkInResult]=await Promise.allSettled([
  facilityPost<Reservation[]>("reservation.get",{facilityId:"FEBBRAIO",memberCode}),
  facilityPost<{found:boolean;session?:Session}>("facility.session.get",{facilityId:"FEBBRAIO",memberCode}),
  facilityPost<WalkIn>("availability.get",{facilityId:"FEBBRAIO",memberCode}),
 ]);
 const reservations=reservationResult.status==="fulfilled"?filterOwnedFacilityRows(reservationResult.value,memberCode):[];
 const session=sessionResult.status==="fulfilled"&&sessionResult.value.found&&isOwnedFacilityRow(sessionResult.value.session,memberCode)?sessionResult.value.session:null;
 return NextResponse.json({member,reservations,session,walkIn:walkInResult.status==="fulfilled"?walkInResult.value:null,warnings:[reservationResult,sessionResult,walkInResult].map((result,index)=>result.status==="rejected"?["RESERVATIONS_UNAVAILABLE","SESSION_UNAVAILABLE","WALK_IN_UNAVAILABLE"][index]:null).filter(Boolean)},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest){
 const actor=adminEmail(request);if(!actor)return NextResponse.json({error:"FORBIDDEN"},{status:403});
 const body=await request.json().catch(()=>null) as {action?:"CREATE_RESERVATION"|"CANCEL_RESERVATION"|"START_SESSION";memberCode?:string;reservationId?:string;startAt?:string;hours?:number;requestId?:string}|null,memberCode=codeOf(body?.memberCode),hours=Number(body?.hours),requestId=String(body?.requestId??"");
 if(!body?.action||!/^[A-Z0-9]{10}$/.test(memberCode)||!requestId)return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
 const member=await env.DB.prepare("SELECT id,status FROM members WHERE member_code=? LIMIT 1").bind(memberCode).first<{id:string;status:string}>();
 if(!member||member.status!=="ACTIVE")return NextResponse.json({error:"MEMBER_NOT_FOUND"},{status:404});
 try{
  let result:unknown;
  if(body.action==="CREATE_RESERVATION"){
   const startAt=String(body.startAt??"");if(!Number.isFinite(Date.parse(startAt))||!Number.isInteger(hours)||hours<1||hours>10)return NextResponse.json({error:"INVALID_RESERVATION"},{status:400});
   result=await facilityPost<Reservation>("reservation.create",{facilityId:"FEBBRAIO",memberCode,startAt,hours,bookingChannel:"STAFF_WEB"},requestId);
   if(!isOwnedFacilityRow(result,memberCode))throw new Error("RESERVATION_OWNERSHIP_MISMATCH");
  }else if(body.action==="CANCEL_RESERVATION"){
   const reservationId=String(body.reservationId??"");if(!reservationId)return NextResponse.json({error:"RESERVATION_ID_REQUIRED"},{status:400});
   result=await facilityPost<Reservation>("reservation.cancel",{facilityId:"FEBBRAIO",memberCode,reservationId},requestId);
   if(!isOwnedFacilityRow(result,memberCode))throw new Error("RESERVATION_OWNERSHIP_MISMATCH");
  }else{
   const reservationId=String(body.reservationId??"");if(!reservationId&&(!Number.isInteger(hours)||hours<1||hours>10))return NextResponse.json({error:"INVALID_SESSION"},{status:400});
   result=await facilityPost<Session>("facility.session.start",{facilityId:"FEBBRAIO",memberCode,...(reservationId?{reservationId}:{hours})},requestId);
   if(!isOwnedFacilityRow(result,memberCode))throw new Error("SESSION_OWNERSHIP_MISMATCH");
  }
  await env.DB.prepare("INSERT INTO member_registration_events (id,member_id,event_type,actor,details_json,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),member.id,`STAFF_STUDIO_${body.action}`,actor,JSON.stringify({requestId,reservationId:body.reservationId??null,hours:Number.isFinite(hours)?hours:null}),Date.now()).run();
  return NextResponse.json({ok:true,result});
 }catch(error){const code=error instanceof Error?error.message:"FACILITY_API_ERROR",status=["FACILITY_IN_USE","ACTIVE_USAGE_EXISTS","TIME_NOT_AVAILABLE","NEXT_RESERVATION_CONFLICT"].includes(code)?409:code==="OUTSIDE_CHECKIN_WINDOW"?422:502;return NextResponse.json({error:code},{status})}
}
