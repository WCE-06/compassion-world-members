import { NextRequest,NextResponse } from "next/server";
import { adminActor } from "@/lib/admin-session";
export async function GET(request:NextRequest){const actor=await adminActor(request);return actor?NextResponse.json({authenticated:true,email:actor.email,role:actor.role,permissions:actor.permissions}):NextResponse.json({authenticated:false},{status:401})}
