import assert from "node:assert/strict";
import{readFileSync}from"node:fs";
import test from"node:test";
const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8"),inbox=readFileSync(new URL("../app/inbox/page.tsx",import.meta.url),"utf8"),route=readFileSync(new URL("../app/api/v1/notifications/entry-thank-you/route.ts",import.meta.url),"utf8");
test("会員証トップは最新3件だけ表示しベルから受信ボックスへ移動する",()=>{assert.match(page,/member\.notices\.slice\(0, 3\)/);assert.match(page,/window\.location\.href="\/inbox"/);assert.match(page,/受信ボックスを確認する/)});
test("受信ボックスは全通知と未読件数を表示する",()=>{assert.match(inbox,/result\.notices/);assert.match(inbox,/unread=notices\.filter/);assert.match(inbox,/受信ボックス/)});
test("同一来店イベントのポイント確定通知で確認中文面を更新する",()=>{assert.match(route,/normalizedPointResult/);assert.match(route,/UPDATE member_notifications SET body=/);assert.match(route,/read_at=NULL/)});
