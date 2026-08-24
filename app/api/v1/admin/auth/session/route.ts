import { NextRequest,NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
export async function GET(request:NextRequest){const email=await requireAdminSession(request);return email?NextResponse.json({authenticated:true,email}):NextResponse.json({authenticated:false},{status:401})}
