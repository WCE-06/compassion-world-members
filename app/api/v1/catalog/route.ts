import { NextResponse } from "next/server";
import { ORDER_PRODUCTS } from "@/lib/order-catalog";
export async function GET() { return NextResponse.json({ products: ORDER_PRODUCTS, lastSyncedAt: new Date().toISOString(), source: "PREVIEW_CATALOG" }); }
