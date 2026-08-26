import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("customer cancel while processor is running enters reconciliation",async()=>{
 const source=await read("app/api/v1/orders/[id]/payment-lock/release/route.ts");
 assert.match(source,/PAYMENT_RECONCILING/);
 assert.match(source,/reconciliationPending/);
});

test("late POS confirmation can consume a released customer-cancelled lock",async()=>{
 const source=await read("app/api/v1/orders/payment-confirmation/route.ts");
 assert.match(source,/lateProcessorCompletion/);
 assert.match(source,/releaseReason==="CUSTOMER_CANCELLED"/);
 assert.match(source,/status IN \('WAITING_STORE_PAYMENT','PAYMENT_PROCESSING','PAYMENT_RECONCILING'\)/);
});

test("reconciling order remains visible to the self register",async()=>{
 const source=await read("app/api/v1/orders/unpaid/route.ts");
 assert.match(source,/PAYMENT_RECONCILING/);
});

test("admin cancellation is idempotent and cancels kitchen work",async()=>{
 const source=await read("app/api/v1/admin/orders/cancel/route.ts");
 assert.match(source,/admin-refund:\$\{order\.id\}/);
 assert.match(source,/UPDATE kitchen_units SET status='CANCELLED'/);
 assert.match(source,/ORDER_ADMIN_CANCELLED/);
});
