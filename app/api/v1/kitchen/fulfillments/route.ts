import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { requireKitchenToken } from "@/lib/kitchen-api";

type Department="FOOD"|"DRINK";
type Action="START"|"READY"|"CALL"|"PICKUP";
const actionRule:Record<Action,{from:string[];to:string;timeColumn?:string}>={
  START:{from:["ACCEPTED"],to:"COOKING"},READY:{from:["ACCEPTED","COOKING"],to:"READY",timeColumn:"ready_at"},CALL:{from:["READY"],to:"CALLED",timeColumn:"called_at"},PICKUP:{from:["READY","CALLED"],to:"PICKED_UP",timeColumn:"picked_up_at"},
};

export async function GET(request:NextRequest){
  if(!await requireKitchenToken(request))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  const department=request.nextUrl.searchParams.get("department") as Department|null;
  if(department!=="FOOD"&&department!=="DRINK")return NextResponse.json({error:"INVALID_DEPARTMENT"},{status:400});
  const result=await env.DB.prepare(`SELECT f.id,f.order_id AS orderId,f.department,f.call_number AS callNumber,f.status,f.ready_at AS readyAt,f.called_at AS calledAt,f.updated_at AS updatedAt,o.pickup_at AS estimatedReadyAt,i.product_name AS productName,i.quantity,i.preparation_minutes AS preparationMinutes FROM order_fulfillments f JOIN orders o ON o.id=f.order_id JOIN order_items i ON i.order_id=f.order_id AND i.department=f.department WHERE f.department=? AND f.status IN ('ACCEPTED','COOKING','READY','CALLED') ORDER BY CASE f.status WHEN 'READY' THEN 0 WHEN 'CALLED' THEN 1 WHEN 'COOKING' THEN 2 ELSE 3 END,f.updated_at`).bind(department).all<{id:string;orderId:string;department:Department;callNumber:number;status:string;readyAt:number|null;calledAt:number|null;updatedAt:number;estimatedReadyAt:number|null;productName:string;quantity:number;preparationMinutes:number}>();
  const grouped=new Map<string,{id:string;orderId:string;department:Department;callNumber:number;status:string;readyAt:number|null;calledAt:number|null;updatedAt:number;estimatedReadyAt:number|null;estimatedMinutes:number;items:{name:string;quantity:number;preparationMinutes:number}[]}>();
  for(const row of result.results){const current=grouped.get(row.id)??{id:row.id,orderId:row.orderId,department:row.department,callNumber:row.callNumber,status:row.status,readyAt:row.readyAt,calledAt:row.calledAt,updatedAt:row.updatedAt,estimatedReadyAt:row.estimatedReadyAt,estimatedMinutes:0,items:[]};current.items.push({name:row.productName,quantity:row.quantity,preparationMinutes:row.preparationMinutes});current.estimatedMinutes=Math.max(current.estimatedMinutes,row.preparationMinutes);grouped.set(row.id,current);}
  return NextResponse.json({department,fulfillments:[...grouped.values()]},{headers:{"Cache-Control":"no-store"}});
}

export async function PATCH(request:NextRequest){
  if(!await requireKitchenToken(request))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  const body=await request.json().catch(()=>null) as {fulfillmentId?:string;action?:Action}|null;
  const fulfillmentId=body?.fulfillmentId?.trim()??"",action=body?.action;
  if(!/^[A-Za-z0-9_-]{8,80}$/.test(fulfillmentId)||!action||!actionRule[action])return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
  const rule=actionRule[action],now=Date.now(),placeholders=rule.from.map(()=>"?").join(",");
  const timeUpdate=rule.timeColumn?`,${rule.timeColumn}=?`:"";
  const bindings=rule.timeColumn?[rule.to,now,now,fulfillmentId,...rule.from]:[rule.to,now,fulfillmentId,...rule.from];
  const result=await env.DB.prepare(`UPDATE order_fulfillments SET status=?,updated_at=?${timeUpdate} WHERE id=? AND status IN (${placeholders})`).bind(...bindings).run();
  if((result.meta.changes??0)===0){const existing=await env.DB.prepare(`SELECT department,call_number AS callNumber,status FROM order_fulfillments WHERE id=?`).bind(fulfillmentId).first();if(!existing)return NextResponse.json({error:"FULFILLMENT_NOT_FOUND"},{status:404});if(existing.status!==rule.to)return NextResponse.json({error:"INVALID_STATUS_TRANSITION",current:existing},{status:409});return NextResponse.json({id:fulfillmentId,...existing});}
  const updated=await env.DB.prepare(`SELECT order_id AS orderId,department,call_number AS callNumber,status,ready_at AS readyAt,called_at AS calledAt,picked_up_at AS pickedUpAt FROM order_fulfillments WHERE id=?`).bind(fulfillmentId).first<{orderId:string;department:Department;callNumber:number;status:string;readyAt:number|null;calledAt:number|null;pickedUpAt:number|null}>();
  if(updated){const states=await env.DB.prepare(`SELECT status FROM order_fulfillments WHERE order_id=?`).bind(updated.orderId).all<{status:string}>();const values=states.results.map(row=>row.status);const orderStatus=values.every(status=>status==="PICKED_UP")?"PICKED_UP":values.some(status=>status==="READY"||status==="CALLED"||status==="PICKED_UP")?"READY":values.some(status=>status==="COOKING")?"COOKING":"ACCEPTED";await env.DB.prepare(`UPDATE orders SET status=?,updated_at=? WHERE id=? AND status NOT IN ('CANCELLED','EXPIRED','REFUNDED')`).bind(orderStatus,now,updated.orderId).run();}
  return NextResponse.json({id:fulfillmentId,...updated});
}
