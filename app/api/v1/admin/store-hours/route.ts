import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { storeHours } from "@/db/schema";

const defaults={id:"AOZORA_KITCHEN",enabled:true,timezone:"Asia/Tokyo",openTime:"11:00",closeTime:"20:00",orderStart:"11:00",lastOrder:"19:30",businessDays:"1,2,3,4,5,6,7"};
function adminEmail(request:NextRequest){const email=request.headers.get("oai-authenticated-user-email")?.toLowerCase();const allowed=((env as unknown as Record<string,string|undefined>).ADMIN_EMAILS??"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);return email&&allowed.includes(email)?email:null}
function time(value:unknown,fallback:string){return typeof value==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)?value:fallback}
function days(value:unknown){const list=Array.isArray(value)?value.map(Number).filter(v=>v>=1&&v<=7):[];return [...new Set(list)].sort().join(",")||defaults.businessDays}

export async function GET(request:NextRequest){if(!adminEmail(request))return NextResponse.json({error:"FORBIDDEN"},{status:403});const [saved]=await getDb().select().from(storeHours).limit(1);return NextResponse.json({hours:saved?{...saved,businessDays:saved.businessDays.split(",").map(Number)}:{...defaults,businessDays:[1,2,3,4,5,6,7]}},{headers:{"Cache-Control":"no-store"}})}
export async function PUT(request:NextRequest){const email=adminEmail(request);if(!email)return NextResponse.json({error:"FORBIDDEN"},{status:403});const body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return NextResponse.json({error:"INVALID_INPUT"},{status:400});const values={id:defaults.id,enabled:body.enabled!==false,timezone:"Asia/Tokyo",openTime:time(body.openTime,defaults.openTime),closeTime:time(body.closeTime,defaults.closeTime),orderStart:time(body.orderStart,defaults.orderStart),lastOrder:time(body.lastOrder,defaults.lastOrder),businessDays:days(body.businessDays),updatedBy:email,updatedAt:new Date()};await getDb().insert(storeHours).values(values).onConflictDoUpdate({target:storeHours.id,set:values});return NextResponse.json({saved:{...values,businessDays:values.businessDays.split(",").map(Number)}})}
