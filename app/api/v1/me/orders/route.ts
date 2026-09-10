import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { authenticatedMember } from "@/lib/member-auth";
import { orderUnits } from "@/lib/kitchen-units";
import { getOrderSchedule } from "@/lib/kitchen-schedule";
import { expireStaleLocks,expireStaleOrder,reconcileCompletedOrders } from "@/lib/order-pos";

type OrderRow={id:string;orderNumber:string;status:string;createdAt:number};
const publicStatus:Record<string,string>={WAITING_STORE_PAYMENT:"WAITING_PAYMENT",PENDING_PAYMENT:"WAITING_PAYMENT",PAYMENT_PROCESSING:"WAITING_PAYMENT",PAYMENT_RECONCILING:"WAITING_PAYMENT",PAID:"ACCEPTED",ACCEPTED:"ACCEPTED",COOKING:"COOKING",READY:"READY"};

export async function GET(request:NextRequest){
 const member=await authenticatedMember(request);if(!member)return NextResponse.json({error:"LINE_AUTH_REQUIRED"},{status:401});
 await expireStaleLocks();await expireStaleOrder();await reconcileCompletedOrders(member.id);
 const rows=await env.DB.prepare(`SELECT id,order_number AS orderNumber,status,created_at AS createdAt FROM orders WHERE member_id=? AND status IN ('WAITING_STORE_PAYMENT','PENDING_PAYMENT','PAYMENT_PROCESSING','PAYMENT_RECONCILING','PAID','ACCEPTED','COOKING','READY') ORDER BY created_at DESC`).bind(member.id).all<OrderRow>();
 const orders=(await Promise.all(rows.results.map(async row=>{
  const units=await orderUnits(row.id),active=units.some(unit=>unit.status!=="PICKED_UP"&&unit.status!=="CANCELLED");
  if(!active&&row.status!=="WAITING_STORE_PAYMENT")return null;
  const schedule=await getOrderSchedule(row.id);
  return{orderNumber:row.orderNumber,status:publicStatus[row.status]??row.status,createdAt:new Date(row.createdAt).toISOString(),units,schedule,scheduleLabel:schedule?null:"提供予定時間を確認しています。しばらくお待ちください。"};
 }))).filter(Boolean);
 return NextResponse.json({orders,checkedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
}
