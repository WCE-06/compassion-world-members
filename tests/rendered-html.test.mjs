import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("会員証アプリを正常に配信する", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /LINE会員証 \| COMPASSION WORLD/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
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
  assert.match(page, /スタジオを予約する/);
  assert.match(page, /モバイルオーダー/);
  assert.match(membershipApi, /api\.line\.me\/v2\/profile/);
  assert.match(linkApi, /VERIFICATION_REQUIRED/);
  assert.match(schema, /identityLinks/);
  assert.match(schema, /studioSessions/);
  assert.match(schema, /paymentStatus/);
  assert.match(hosting, /"d1": "DB"/);
});
