import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/v1/me/notifications/route.ts",import.meta.url),"utf8");
const popupRoute=readFileSync(new URL("../app/api/v1/me/notifications/popup/route.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../drizzle/0033_notification_popup_deliveries.sql",import.meta.url),"utf8");
const orderNotices=readFileSync(new URL("../lib/order-notifications.ts",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");

test("ポップアップは端末保存ではなくサーバーで一度だけ配信する",()=>{assert.match(page,/notifications\/popup/);assert.match(page,/method:"POST"/);assert.doesNotMatch(page,/cw:push-seen:/);assert.match(popupRoute,/INSERT OR IGNORE INTO notification_popup_deliveries/);assert.match(migration,/WHERE `event_type` = 'ENTRY_THANK_YOU'/)});
test("前日の入店通知と表示済み入店通知は旧画面でも新着扱いにしない",()=>{assert.match(popupRoute,/date\(COALESCE\(n\.occurred_at,n\.created_at\)/);assert.match(route,/LEFT JOIN notification_popup_deliveries/);assert.match(route,/COALESCE\(n\.read_at,d\.delivered_at\)/)});
test("アプリ表示中は新着通知を定期取得し復帰時にも更新する",()=>{assert.match(page,/setInterval\(refresh,10_000\)/);assert.match(page,/visibilitychange/);assert.match(route,/WHERE n\.member_id=\?/)});
test("未読数をベル横へ表示し通知を開くと既読にする",()=>{assert.match(page,/unreadCount/);assert.match(page,/api\/v1\/me\/notifications/);assert.match(css,/\.member-push/)});
test("注文確定と商品別完成通知は一意なイベントとして保存する",()=>{assert.match(orderNotices,/ORDER_ACCEPTED:\$\{orderId\}/);assert.match(orderNotices,/KITCHEN_UNIT_READY:\$\{unitId\}/);assert.match(orderNotices,/番のお品物が完成しました/)});
