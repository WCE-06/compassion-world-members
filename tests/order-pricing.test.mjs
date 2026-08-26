import test from "node:test";
import assert from "node:assert/strict";
import { calculateOrderTotal } from "../lib/order-pricing.ts";

test("スマレジ同様に税率別の税抜合計へ課税してから端数処理する",()=>{
  const product={price:537,basePrice:498,taxDivision:"1",taxRate:8,taxRounding:"1"};
  assert.equal(calculateOrderTotal([{product,quantity:1},{product,quantity:1}]),1075);
});

test("税込価格の商品は表示価格をそのまま合算する",()=>{
  assert.equal(calculateOrderTotal([{product:{price:500,basePrice:455,taxDivision:"0",taxRate:10,taxRounding:"1"},quantity:2}]),1000);
});

test("税率と丸め方法が異なる商品は別グループで計算する",()=>{
  assert.equal(calculateOrderTotal([
    {product:{price:537,basePrice:498,taxDivision:"1",taxRate:8,taxRounding:"1"},quantity:2},
    {product:{price:110,basePrice:100,taxDivision:"1",taxRate:10,taxRounding:"0"},quantity:1},
  ]),1185);
});
