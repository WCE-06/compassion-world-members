import test from "node:test";
import assert from "node:assert/strict";
import { isKitchenInStoreBarcode, normalizedKitchenMenuCategory } from "../lib/kitchen-catalog-rules.ts";

test("29インストアバーコード以外を注文カタログへ含めない",()=>{
  assert.equal(isKitchenInStoreBarcode("2901234567890"),true);
  assert.equal(isKitchenInStoreBarcode("4901234567890"),false);
  assert.equal(isKitchenInStoreBarcode("290123"),false);
});

test("ファンタなどの飲料をサイドメニューへ分類しない",()=>{
  assert.equal(normalizedKitchenMenuCategory("ファンタ メロン","food-side"),"soft-simple");
  assert.equal(normalizedKitchenMenuCategory("オレンジジュース","food-side"),"soft-simple");
});
