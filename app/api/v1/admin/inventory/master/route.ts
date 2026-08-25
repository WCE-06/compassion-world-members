import {env} from "cloudflare:workers";
import {NextRequest,NextResponse} from "next/server";
import {requireAdminSession} from "@/lib/admin-session";

const runtime=()=>env as unknown as Record<string,string|undefined>;
async function actor(request:NextRequest){const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase(),allowed=(runtime().ADMIN_EMAILS??"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);return email&&allowed.includes(email)?email:await requireAdminSession(request)}

export async function GET(request:NextRequest){if(!await actor(request))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});const rows=await env.DB.prepare("SELECT product_code AS productCode,product_name AS productName,product_id AS productId,category_id AS categoryId,price,cost,display_flag AS displayFlag,stock_control_division AS stockControlDivision,inventory_managed AS inventoryManaged,tags,source_updated_at AS sourceUpdatedAt FROM inventory_product_settings ORDER BY product_name LIMIT 10000").all();return NextResponse.json({products:rows.results,total:rows.results.length},{headers:{"Cache-Control":"no-store"}})}
