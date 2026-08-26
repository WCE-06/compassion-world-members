import { env } from "cloudflare:workers";

export type KitchenDepartment = "FOOD" | "DRINK";
export type KitchenUnitView = {
  unitId: string;
  orderItemId: string;
  productName: string;
  department: KitchenDepartment;
  callNumber: number;
  callNumberLabel: string;
  status: string;
};

export function kitchenBusinessDate(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(now));
}

export async function allocateKitchenUnitNumber(department: KitchenDepartment, callDate: string, now = Date.now()) {
  const row = await env.DB.prepare(
    "INSERT INTO kitchen_unit_counters(call_date,department,last_number,updated_at) VALUES(?,?,1,?) " +
    "ON CONFLICT(call_date,department) DO UPDATE SET last_number=CASE WHEN last_number>=999 THEN 1 ELSE last_number+1 END,updated_at=excluded.updated_at " +
    "RETURNING last_number AS number",
  ).bind(callDate, department, now).first<{ number: number }>();
  if (!row) throw new Error("CALL_NUMBER_ALLOCATION_FAILED");
  return row.number;
}

export function callNumberLabel(department: KitchenDepartment, callNumber: number) {
  return `${department === "FOOD" ? "F" : "D"}${String(callNumber).padStart(3, "0")}`;
}

export async function orderUnits(orderId: string): Promise<KitchenUnitView[]> {
  const result = await env.DB.prepare(
    `SELECT u.id AS unitId,u.order_item_id AS orderItemId,i.product_name AS productName,
      u.department,u.call_number AS callNumber,u.status
     FROM kitchen_units u JOIN order_items i ON i.id=u.order_item_id
     WHERE u.order_id=? ORDER BY u.department,u.call_number,u.unit_index`,
  ).bind(orderId).all<Omit<KitchenUnitView, "callNumberLabel">>();
  return result.results.map(unit => ({ ...unit, callNumberLabel: callNumberLabel(unit.department, unit.callNumber) }));
}
