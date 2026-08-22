import { env } from "cloudflare:workers";

type Department="FOOD"|"DRINK";
type ScheduleItem={productId:string;productCode:string;name:string;quantity:number;department:Department;preparationMinutes?:number;options?:unknown[]};
export type KitchenSchedule={status:string;food:{estimatedMinutes:number|null;readyAt:string}|null;drink:{workMinutes:number;startAt:string;readyAt:string;servingMode:string}|null;calculationVersion?:string};

function runtime(){return env as unknown as {KITCHEN_API_BASE_URL?:string;KITCHEN_API_TOKEN?:string}}
function endpoint(path:string){return `${(runtime().KITCHEN_API_BASE_URL??"https://compassion-world-kitchen.combetter27.chatgpt.site").replace(/\/$/,"")}${path}`}
async function request(path:string,method:"POST"|"PUT",body:unknown){
 const token=runtime().KITCHEN_API_TOKEN;if(!token)return null;
 try{const response=await fetch(endpoint(path),{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(2_500)});return response.ok?await response.json() as KitchenSchedule:null}catch{return null}
}

export async function estimateKitchenSchedule(requestId:string,items:ScheduleItem[]){
 const servingMode=items.some(item=>item.department==="FOOD")&&items.some(item=>item.department==="DRINK")?"WITH_FOOD":"AS_SOON_AS_POSSIBLE";
 return request("/api/v1/schedule/estimate","POST",{requestId,orderedAt:new Date().toISOString(),servingMode,serviceType:"TAKEOUT",items});
}

export async function confirmKitchenSchedule(orderId:string,reason="決済完了時の確定計算"){
 const items=await env.DB.prepare(`SELECT product_id AS productId,product_code AS productCode,product_name AS name,quantity,department,preparation_minutes AS preparationMinutes,selected_options_json AS optionsJson FROM order_items WHERE order_id=?`).bind(orderId).all<ScheduleItem&{optionsJson:string}>();
 if(!items.results.length)return null;
 const calls=await env.DB.prepare(`SELECT department,call_number AS callNumber FROM order_fulfillments WHERE order_id=?`).bind(orderId).all<{department:Department;callNumber:number}>();
 const food=calls.results.find(item=>item.department==="FOOD"),drink=calls.results.find(item=>item.department==="DRINK"),scheduleItems=items.results.map(({optionsJson,...item})=>({...item,options:safeArray(optionsJson)}));
 const servingMode=food&&drink?"WITH_FOOD":"AS_SOON_AS_POSSIBLE";
 return request(`/api/v1/schedule/orders/${encodeURIComponent(orderId)}`,"PUT",{requestId:`confirm-${orderId}`,items:scheduleItems,foodCallNumber:food?.callNumber,drinkCallNumber:drink?.callNumber,servingMode,mode:"AUTOMATIC",reason});
}

function safeArray(value:string){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}}
