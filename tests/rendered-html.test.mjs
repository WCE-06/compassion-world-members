import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("会員証アプリを正常に配信する", async () => {
  const [layout, page] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);
  assert.match(layout, /COMPASSION WORLD POINT CARD/);
  assert.match(layout, /og\.png/);
  assert.match(page, /POINT CARD/);
  assert.doesNotMatch(`${layout}\n${page}`, /Your site is taking shape|codex-preview/);
});

test("LIFF・移行・共通セッションの接続点を保持する", async () => {
  const [page, membershipApi, linkApi, schema, hosting] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/membership-links/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
  ]);
  assert.match(page, /NEXT_PUBLIC_LIFF_ID/);
  assert.match(page, /api\/v1\/me\/membership/);
  assert.match(page, /window\.location\.href = "\/availability"/);
  assert.match(page, /モバイルオーダー/);
  assert.match(page, /A7K4P9X2M6/);
  assert.match(page, /ポイント履歴/);
  assert.match(page, /お知らせ/);
  assert.match(page, /bottom-tabs/);
  assert.match(page, /wallet-balances/);
  assert.match(page, /Aozora Kitchen/);
  assert.match(page, /product-request/);
  assert.match(membershipApi, /api\.line\.me\/v2\/profile/);
  assert.match(linkApi, /VERIFICATION_REQUIRED/);
  assert.match(schema, /identityLinks/);
  assert.match(schema, /studioSessions/);
  assert.match(schema, /paymentStatus/);
  assert.match(hosting, /"d1": "DB"/);
});
