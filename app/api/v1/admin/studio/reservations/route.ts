import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import {requireAdminSession} from "@/lib/admin-session";
import { facilityPost } from "@/lib/facility-api";

type StaffReservation={reservationId:string;memberCode:string;memberName?:string;facilityId:string;startAt:string;endAt:string;status:string;paymentStatus?:string;sessionStatus?:string};
function admin(request:NextRequest){const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase(),allowed=((env as unknown as Record<string,string|undefined>).ADMIN_EMAILS??"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);return email&&allowed.includes(email)?email:null}

export async function GET(request:NextRequest){if(!(admin(request)??await requireAdminSession(request)))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});const from=request.nextUrl.searchParams.get("from")??new Date().toISOString().slice(0,10),to=request.nextUrl.searchParams.get("to")??new Date(Date.now()+31*86400000).toISOString().slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||Date.parse(to)-Date.parse(from)>93*86400000)return NextResponse.json({error:"INVALID_PERIOD"},{status:400});try{const rows=await facilityPost<StaffReservation[]>("staff.reservations.list",{facilityId:"FEBBRAIO",from,to,includeCancelled:true},crypto.randomUUID(),12_000);const codes=[...new Set(rows.map(row=>String(row.memberCode??"").trim().toUpperCase()).filter(code=>/^[A-Z0-9]{10}$/.test(code)))],names=new Map<string,string>();for(let i=0;i<codes.length;i+=80){const chunk=codes.slice(i,i+80),result=await env.DB.prepare(`SELECT member_code AS memberCode,display_name AS displayName FROM members WHERE member_code IN (${chunk.map(()=>"?").join(",")})`).bind(...chunk).all<{memberCode:string;displayName:string}>();result.results.forEach(row=>names.set(row.memberCode,row.displayName))}return NextResponse.json({connected:true,reservations:rows.map(row=>({...row,memberName:names.get(row.memberCode)||row.memberName||"氏名未登録"}))},{headers:{"Cache-Control":"no-store"}})}catch(error){return NextResponse.json({connected:false,reservations:[],error:"STAFF_RESERVATIONS_API_NOT_CONNECTED",message:"共通施設APIへスタッフ専用の全予約取得を接続してください。",detail:error instanceof Error?error.message:"FACILITY_API_ERROR"},{status:502,headers:{"Cache-Control":"no-store"}})}}



