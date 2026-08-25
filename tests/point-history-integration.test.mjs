import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const route=readFileSync(new URL("../app/api/v1/me/points/route.ts",import.meta.url),"utf8"),page=readFileSync(new URL("../app/points/page.tsx",import.meta.url),"utf8"),home=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
test("ポイント履歴は会員本人認証と月指定を必須にする",()=>{assert.match(route,/authenticatedMember/);assert.match(route,/INVALID_MONTH/);assert.match(route,/memberCode:member\.memberCode/);assert.match(route,/POINT_HISTORY_MEMBER_MISMATCH/)});
test("ポイント履歴は月送りで取得し現在残高を会員表示へ同期する",()=>{assert.match(page,/moveMonth/);assert.match(page,/最終更新/);assert.match(route,/UPDATE members SET points_balance/);assert.match(home,/window\.location\.href="\/points"/)});
test("入館ポイントを会計履歴と統合し読み込み中を明示する",()=>{assert.match(route,/event_type='ENTRY_THANK_YOU'/);assert.match(route,/label:"入館ポイント"/);assert.match(page,/<progress/);assert.match(page,/最新の情報を確認しています/);assert.doesNotMatch(page,/スマレジの確定データ/)});
test("スマレジに同じ入館加算があれば通知由来の履歴を重ねない",()=>{assert.match(route,/Math\.abs\(Date\.parse\(item\.occurredAt\)-row\.occurredAt\)<=15\*60\*1000/);assert.match(route,/matched\.label="入館ポイント"/);assert.match(page,/ポイント加算/);assert.doesNotMatch(page,/ポイント処理/)});
