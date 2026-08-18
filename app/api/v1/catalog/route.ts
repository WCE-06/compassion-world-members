import { NextResponse } from "next/server";
import { getOrderProducts } from "@/lib/order-catalog";
export async function GET(){try{const catalog=await getOrderProducts();return NextResponse.json({...catalog,source:"SMAREGI_SELF_REGISTER"},{headers:{"Cache-Control":"public, max-age=60"}})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"CATALOG_ERROR"},{status:502})}}
