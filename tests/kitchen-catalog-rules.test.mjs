import test from "node:test";
import assert from "node:assert/strict";
import { isKitchenInStoreBarcode, normalizedKitchenMenuCategory } from "../lib/kitchen-catalog-rules.ts";

test("29インストアバーコード以外を注文カタログへ含めない",()=>{
  assert.equal(isKitchenInStoreBarcode("2901234567890"),true);
  assert.equal(isKitchenInStoreBarcode("290123"),true);
  assert.equal(isKitchenInStoreBarcode("4901234567890"),false);
});

test("ファンタなどの飲料をサイドメニューへ分類しない",()=>{
  assert.equal(normalizedKitchenMenuCategory("ファンタ メロン","food-side"),"soft-simple");
  assert.equal(normalizedKitchenMenuCategory("オレンジジュース","food-side"),"soft-simple");
  assert.equal(normalizedKitchenMenuCategory("自家製レモネード","food-side"),"soft-simple");
});

test("割材名を含む酒類をソフトドリンクへ混入させない",()=>{
  for(const name of ["ウーロンハイ(角)","緑茶ハイ(麦)","コークハイ(バーボン)","ラムネ割り(芋)","梅酒　ウーロン割り"]){
    assert.equal(normalizedKitchenMenuCategory(name,"soft-simple"),"alcohol-main",name);
  }
  for(const name of ["カシスウーロン","カルーアミルク","テキーラソーダ","ファジーネーブル","レゲエパンチ","大人のレモネード"]){
    assert.equal(normalizedKitchenMenuCategory(name,"soft-simple"),"alcohol-cocktail",name);
  }
  assert.equal(normalizedKitchenMenuCategory("瓶ビール(ノンアル)","alcohol-main"),"soft-simple");
  assert.equal(normalizedKitchenMenuCategory("カシスウーロン(モクテル)","alcohol-cocktail"),"soft-mocktail");
});
