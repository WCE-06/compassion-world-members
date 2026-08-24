import { NextRequest,NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";

const browserAdminApis=["/api/v1/admin/members","/api/v1/admin/member-csv-import","/api/v1/admin/studio","/api/v1/admin/catalog","/api/v1/admin/category-schedules","/api/v1/admin/store-hours"];
export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path.startsWith("/api/v1/admin/auth/")||path==="/member-admin/login")return NextResponse.next();
 const protectsPage=path==="/member-admin",protectsApi=browserAdminApis.some(prefix=>path.startsWith(prefix));
 if(!protectsPage&&!protectsApi)return NextResponse.next();
 const email=await requireAdminSession(request);
 if(!email){if(protectsApi)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});const url=request.nextUrl.clone();url.pathname="/member-admin/login";url.search="";return NextResponse.redirect(url)}
 const headers=new Headers(request.headers);headers.set("oai-authenticated-user-email",email);
 return NextResponse.next({request:{headers}});
}
export const config={matcher:["/member-admin/:path*","/api/v1/admin/:path*"]};
