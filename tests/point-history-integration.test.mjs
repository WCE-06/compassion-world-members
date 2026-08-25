import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const route=readFileSync(new URL("../app/api/v1/me/points/route.ts",import.meta.url),"utf8"),page=readFileSync(new URL("../app/points/page.tsx",import.meta.url),"utf8"),home=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
test("ポイント履歴は会員本人認証と月指定を必須にする",()=>{assert.match(route,/authenticatedMember/);assert.match(route,/INVALID_MONTH/);assert.match(route,/memberCode:member\.memberCode/);assert.match(route,/POINT_HISTORY_MEMBER_MISMATCH/)});
test("ポイント履歴は月送りで取得しスマレジ残高を会員表示へ同期する",()=>{assert.match(page,/moveMonth/);assert.match(page,/スマレジ最終取得/);assert.match(route,/UPDATE members SET points_balance/);assert.match(home,/window\.location\.href="\/points"/)});
