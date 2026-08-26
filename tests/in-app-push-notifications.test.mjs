import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/v1/me/notifications/route.ts",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");

test("アプリ起動時は端末でまだ表示していない未読通知だけをプッシュ風表示する",()=>{assert.match(page,/cw:push-seen:/);assert.match(page,/!stored\.has\(item\.id\)/);assert.match(page,/localStorage\.setItem/);assert.match(page,/MemberPush/)});
test("アプリ表示中は新着通知を定期取得し復帰時にも更新する",()=>{assert.match(page,/setInterval\(refresh,10_000\)/);assert.match(page,/visibilitychange/);assert.match(route,/WHERE member_id=\?/)});
test("未読数をベル横へ表示し通知を開くと既読にする",()=>{assert.match(page,/unreadCount/);assert.match(page,/api\/v1\/me\/notifications/);assert.match(css,/\.member-push/)});
