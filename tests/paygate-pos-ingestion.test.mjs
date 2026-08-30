import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PAYGATE POS取引は商品単位のキッチン注文へ冪等登録される", async () => {
  const source = await readFile(new URL("../app/api/v1/kitchen/pos-transactions/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireKitchenToken/);
  assert.match(source, /smaregi_transaction_id=\? OR id=\?/);
  assert.match(source, /allocateKitchenUnitNumber/);
  assert.match(source, /for \(let unitIndex = 1; unitIndex <= line\.quantity/);
  assert.match(source, /NO_KITCHEN_ITEMS/);
  assert.match(source, /PAYGATE_POS_TRANSACTION_IMPORTED/);
});

test("POS取消時は未受渡の商品をキッチンから取り消す", async () => {
  const source = await readFile(new URL("../app/api/v1/kitchen/pos-transactions/route.ts", import.meta.url), "utf8");
  assert.match(source, /transaction\.cancelDivision === "1"/);
  assert.match(source, /status NOT IN \('PICKED_UP','CANCELLED'\)/);
});
