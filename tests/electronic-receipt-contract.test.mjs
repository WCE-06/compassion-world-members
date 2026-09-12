import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("electronic receipt migration is additive and complete",()=>{
  const sql=read("drizzle/0037_electronic_receipts.sql");
  for(const table of ["receipt_devices","purchases","purchase_items","purchase_adjustments","receipt_artifacts","purchase_audit_logs"]){assert.equal(sql.includes(`CREATE TABLE \`${table}\``),true)}
  assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM|ALTER TABLE/);
});

test("device and artifact tables have an additive compatibility migration",()=>{
  const sql=read("drizzle/0038_purchase_device_artifacts.sql");
  assert.equal(sql.includes("CREATE TABLE `purchase_devices`"),true);
  assert.equal(sql.includes("CREATE TABLE `purchase_artifacts`"),true);
  assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM|ALTER TABLE/);
});

test("purchase ingestion enforces safety rules",()=>{
  const route=read("app/api/v1/purchases/route.ts");
  assert.match(route,/IDEMPOTENCY_CONFLICT/);
  assert.match(route,/ELECTRONIC_RECEIPT_REQUIRED/);
  assert.match(route,/totalIncludingTax>=50000/);
  assert.match(route,/requireReceiptDevice\(request,"purchase:create"\)/);
  assert.match(route,/PAYMENT_UNKNOWN/);
});

test("member purchase APIs use live LINE identity",()=>{
  for(const path of ["app/api/v1/me/purchases/route.ts","app/api/v1/me/purchases/[receiptId]/route.ts","app/api/v1/me/purchases/[receiptId]/pdf/route.ts"]){assert.match(read(path),/authenticatedLiveMember/)}
});

test("receipt objects use a private dedicated prefix",()=>{
  const route=read("app/api/v1/purchases/route.ts");
  assert.match(route,/electronic-receipts\//);
  assert.match(route,/private, no-store/);
});
