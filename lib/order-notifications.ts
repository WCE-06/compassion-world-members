import { env } from "cloudflare:workers";
import { callNumberLabel } from "@/lib/kitchen-units";

export async function ensureOrderAcceptedNotice(orderId:string,now=Date.now()){
 const order=await env.DB.prepare(`SELECT o.member_id AS memberId,o.order_number AS orderNumber FROM orders o WHERE o.id=?`).bind(orderId).first<{memberId:string;orderNumber:string}>();if(!order)return;
 const units=await env.DB.prepare(`SELECT department,call_number AS callNumber FROM kitchen_units WHERE order_id=? ORDER BY department,call_number`).bind(orderId).all<{department:"FOOD"|"DRINK";callNumber:number}>(),numbers=units.results.map(unit=>callNumberLabel(unit.department,unit.callNumber)).join("、");
 await env.DB.prepare(`INSERT OR IGNORE INTO member_notifications(id,event_id,member_id,event_type,category,title,body,sender,channel,delivery_status,metadata_json,occurred_at,created_at,updated_at) VALUES(?,?,?,?,?,'ご注文を受け付けました',?,'Aozora Kitchen','CARD','SAVED',?,?,?,?)`).bind(`notice_order_${orderId}`,`ORDER_ACCEPTED:${orderId}`,order.memberId,"ORDER_ACCEPTED","ORDER",`注文番号 ${order.orderNumber}\n${numbers?`呼出番号 ${numbers}\n`:""}商品ごとの完成状況は会員証でお知らせします。`,JSON.stringify({orderId}),now,now,now).run();
}

export async function ensureUnitReadyNotice(unitId:string,now=Date.now()){
 const unit=await env.DB.prepare(`SELECT u.order_id AS orderId,o.member_id AS memberId,u.department,u.call_number AS callNumber,i.product_name AS productName FROM kitchen_units u JOIN orders o ON o.id=u.order_id JOIN order_items i ON i.id=u.order_item_id WHERE u.id=? AND u.status IN ('READY','CALLED','PICKED_UP')`).bind(unitId).first<{orderId:string;memberId:string;department:"FOOD"|"DRINK";callNumber:number;productName:string}>();if(!unit)return;
 const number=callNumberLabel(unit.department,unit.callNumber);
 await env.DB.prepare(`INSERT OR IGNORE INTO member_notifications(id,event_id,member_id,event_type,category,title,body,sender,channel,delivery_status,metadata_json,occurred_at,created_at,updated_at) VALUES(?,?,?,?,? ,?,?, 'Aozora Kitchen','CARD','SAVED',?,?,?,?)`).bind(`notice_ready_${unitId}`,`KITCHEN_UNIT_READY:${unitId}`,unit.memberId,"KITCHEN_UNIT_READY","ORDER",`${number}番のお品物が完成しました`,`${unit.productName}ができあがりました。\n受取カウンターへお越しください。`,JSON.stringify({orderId:unit.orderId,unitId,callNumber:number}),now,now,now).run();
}
