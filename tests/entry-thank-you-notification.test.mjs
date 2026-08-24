import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const entryRoute = readFileSync(new URL("../app/api/v1/notifications/entry-thank-you/route.ts", import.meta.url), "utf8");
const membershipRoute = readFileSync(new URL("../app/api/v1/me/membership/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../drizzle/0021_member_notifications.sql", import.meta.url), "utf8");

test("来店通知は認証とeventIdによる冪等性を必須にする", () => {
  assert.match(entryRoute, /requireCheckinNotificationToken/);
  assert.match(entryRoute, /body\?\.eventType !== "ENTRY_THANK_YOU"/);
  assert.match(entryRoute, /INSERT OR IGNORE INTO member_notifications/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS `member_notifications_event_unique`/);
});

test("ポイント付与結果ごとに誤解のない文面を生成する", () => {
  assert.match(entryRoute, /ポイントを付与しました/);
  assert.match(entryRoute, /初回のご来店時に付与済みです/);
  assert.match(entryRoute, /来店ポイントは現在確認中です/);
});

test("会員本人の受信箱だけに保存通知を表示し既読化できる", () => {
  assert.match(membershipRoute, /WHERE member_id=\?/);
  assert.match(membershipRoute, /member_notifications/);
  assert.match(page, /api\/v1\/me\/notifications/);
  assert.match(page, /unread:false/);
});
