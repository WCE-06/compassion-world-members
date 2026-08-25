import assert from"node:assert/strict";import{readFileSync}from"node:fs";import test from"node:test";
const membership=readFileSync(new URL("../app/api/v1/me/membership/route.ts",import.meta.url),"utf8"),inbox=readFileSync(new URL("../app/api/v1/me/notifications/route.ts",import.meta.url),"utf8"),shared=readFileSync(new URL("../lib/member-notices.ts",import.meta.url),"utf8");
test("会員証トップと受信ボックスは同じ通知生成関数を使う",()=>{assert.match(membership,/welcomeNotice\(member\)/);assert.match(inbox,/welcomeNotice\(profile\)/);assert.match(membership,/storedNotice/);assert.match(inbox,/storedNotice/)});
test("ウェルカムメッセージのIDと本文は一か所で定義する",()=>{assert.match(shared,/id:`welcome:\$\{member\.id\}`/);assert.equal((shared.match(/新しいポイントカードのご利用ありがとうございます/g)??[]).length,1)});
