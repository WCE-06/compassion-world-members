import { env } from "cloudflare:workers";

const DEFAULT_BASE_URL="https://compassion-world-kitchen.combetter27.chatgpt.site";

export type OrderSchedule={
  calculatedAt:string;status:"ESTIMATED"|"CONFIRMED";calculationVersion:string;
  food:{estimatedMinutes:number;originalReadyAt?:string|null;readyAt:string;callNumber?:number|null}|null;
  drink:{workMinutes:number;originalReadyAt?:string|null;startAt:string;readyAt:string;servingMode:string;callNumber?:number|null}|null;
  updatedAt?:string;updateReason?:string;updateMode?:string;
};

type ScheduleItem={productId:string;productCode:string;name:string;quantity:number;department:"FOOD"|"DRINK";preparationMinutes?:number;options?:unknown[]};

function config(){const runtime=env as unknown as Record<string,string|undefined>;return{base:(runtime.KITCHEN_SCHEDULE_API_BASE_URL??DEFAULT_BASE_URL).replace(/\/$/,""),token:runtime.KITCHEN_API_TOKEN??""};}

async function requestSchedule<T>(path:string,init:RequestInit={}){const {base,token}=config();if(!token)throw new Error("KITCHEN_API_TOKEN_NOT_CONFIGURED");const response=await fetch(`${base}${path}`,{...init,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(init.headers??{})}});if(!response.ok)throw new Error(`KITCHEN_SCHEDULE_HTTP_${response.status}`);return response.json() as Promise<T>;}

export async function estimateOrderSchedule(requestId:string,items:ScheduleItem[]){return requestSchedule<OrderSchedule>("/api/v1/schedule/estimate",{method:"POST",body:JSON.stringify({requestId,orderedAt:new Date().toISOString(),items,servingMode:items.some(item=>item.department==="FOOD")&&items.some(item=>item.department==="DRINK")?"WITH_FOOD":"AS_SOON_AS_POSSIBLE"})});}

export async function confirmOrderSchedule(orderId:string,reason:string){const [itemsResult,fulfillmentResult]=await Promise.all([env.DB.prepare(`SELECT product_id AS productId,product_code AS productCode,product_name AS name,quantity,department,preparation_minutes AS preparationMinutes,selected_options_json AS optionsJson FROM order_items WHERE order_id=? ORDER BY rowid`).bind(orderId).all<ScheduleItem&{optionsJson:string}>(),env.DB.prepare(`SELECT department,call_number AS callNumber FROM order_fulfillments WHERE order_id=?`).bind(orderId).all<{department:"FOOD"|"DRINK";callNumber:number}>()]);const items=itemsResult.results.map(({optionsJson,...item})=>({...item,options:safeOptions(optionsJson)}));if(!items.length)throw new Error("ORDER_ITEMS_NOT_FOUND");const food=fulfillmentResult.results.find(item=>item.department==="FOOD"),drink=fulfillmentResult.results.find(item=>item.department==="DRINK");const schedule=await requestSchedule<OrderSchedule>(`/api/v1/schedule/orders/${encodeURIComponent(orderId)}`,{method:"PUT",body:JSON.stringify({requestId:`schedule:${orderId}`,items,foodCallNumber:food?.callNumber,drinkCallNumber:drink?.callNumber,servingMode:food&&drink?"WITH_FOOD":"AS_SOON_AS_POSSIBLE",mode:"AUTOMATIC",reason})});await env.DB.prepare(`UPDATE orders SET pickup_at=?,updated_at=? WHERE id=?`).bind(scheduleReadyAt(schedule),Date.now(),orderId).run();return schedule;}

export async function getOrderSchedule(orderId:string){try{return await requestSchedule<OrderSchedule>(`/api/v1/schedule/orders/${encodeURIComponent(orderId)}`,{cache:"no-store"})}catch{return null;}}

export function scheduleReadyAt(schedule:OrderSchedule|null){const values=[schedule?.food?.readyAt,schedule?.drink?.readyAt].filter((value):value is string=>Boolean(value)).map(Date.parse).filter(Number.isFinite);return values.length?Math.max(...values):null;}

function safeOptions(value:string){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}}
