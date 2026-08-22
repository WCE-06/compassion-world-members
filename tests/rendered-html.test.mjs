import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("会員証アプリを正常に配信する", async () => {
  const [layout, page] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);
  assert.match(layout, /COMPASSION WORLD Members/);
  assert.match(layout, /og\.png/);
  assert.match(page, /POINT CARD/);
  assert.doesNotMatch(`${layout}\n${page}`, /Your site is taking shape|codex-preview/);
});

test("LIFF・移行・共通セッションの接続点を保持する", async () => {
  const [page, membershipApi, memberAuth, linkApi, schema, hosting] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("lib/member-auth.ts", root), "utf8"),
    readFile(new URL("app/api/v1/membership-links/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
  ]);
  assert.match(page, /api\/v1\/client-config/);
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
  assert.match(page, /mobile-order/);
  assert.match(page, /新しく予約する/);
  assert.match(page, /商品を注文する/);
  assert.match(memberAuth, /api\.line\.me\/v2\/profile/);
  assert.match(membershipApi, /authenticatedMember/);
  assert.match(linkApi, /VERIFICATION_REQUIRED/);
  assert.match(schema, /identityLinks/);
  assert.match(schema, /studioSessions/);
  assert.match(schema, /paymentStatus/);
  assert.match(hosting, /"d1": "DB"/);
});

test("モバイル注文の商品画像を切り抜かず、飲料を段階選択する", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(page, /\['drink','ドリンク'\]/);
  assert.match(page, /category==="drink"&&<section className="drink-family-choices"/);
  assert.match(page, /chooseCategory\("soft-simple"\)/);
  assert.match(page, /chooseCategory\("alcohol-main"\)/);
  assert.match(css, /drink-family-choices\+\.order-workspace\{display:none\}/);
  assert.match(css, /span\.product-image\{[^}]*aspect-ratio:4\/3/);
  assert.match(css, /span\.product-image img\{[^}]*width:auto[^}]*height:auto[^}]*max-width:100%[^}]*max-height:100%[^}]*object-fit:contain/);
});

test("モクテルをベースと割材の掛け算で注文できる", async () => {
  const [page, pairing, sync] = await Promise.all([
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("lib/drink-pairing.ts", root), "utf8"),
    readFile(new URL("scripts/sync-preview-catalog.mjs", root), "utf8"),
  ]);
  assert.match(page, /category==="soft-mocktail"/);
  assert.match(page, /ベースと割材から\{category==="soft-mocktail"\?"モクテル":"カクテル"\}/);
  assert.match(page, /bucket\(p\)===category&&p\.cocktailBase&&p\.cocktailMixer/);
  assert.match(pairing, /ファジーネーブル\|レゲエパンチ/);
  assert.match(pairing, /ウーロン茶/);
  assert.match(sync, /inferMocktailPair/);
});

test("セルフレジの商品税情報とオプション構造をモバイル表示へ引き継ぐ", async () => {
  const [page, catalog, sync, css] = await Promise.all([
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("lib/order-catalog.ts", root), "utf8"),
    readFile(new URL("scripts/sync-preview-catalog.mjs", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(catalog, /basePrice/);
  assert.match(catalog, /taxDivision/);
  assert.match(catalog, /optionGroups/);
  assert.match(sync, /basePrice: Number\(product\.basePrice/);
  assert.match(sync, /optionGroups: Array\.isArray/);
  assert.match(page, /税込 ¥/);
  assert.match(page, /税抜 ¥/);
  assert.match(page, /<b>税抜 ¥\{taxExcludedPrice\(product\)/);
  assert.match(page, /<small>税込 ¥\{product\.price/);
  assert.match(page, /税抜小計/);
  assert.match(page, /税込合計 ¥\{total/);
  assert.match(page, /Math\.ceil\(product\.price\*100\/\(100\+Number\(product\.taxRate\?\?10\)\)\)/);
  assert.match(page, /オプションあり/);
  assert.match(css, /\.dual-price/);
});

test("PRプレビューが古い画面をキャッシュし続けない", async () => {
  const [html, preview, workflow] = await Promise.all([
    readFile(new URL("preview/index.html", root), "utf8"),
    readFile(new URL("preview/main.tsx", root), "utf8"),
    readFile(new URL(".github/workflows/pr-preview.yml", root), "utf8"),
  ]);
  assert.match(html, /no-cache, no-store, must-revalidate/);
  assert.match(preview, /VITE_PREVIEW_REVISION/);
  assert.match(preview, /searchParams\.set\("cache", Date\.now\(\)\.toString\(\)\)/);
  assert.match(workflow, /VITE_PREVIEW_REVISION: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
});

test("管理画面で店舗営業時間と時間帯限定メニューを設定できる", async () => {
  const [page, hoursApi, catalogApi, catalog, schema, migration] = await Promise.all([
    readFile(new URL("app/menu-admin/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/admin/store-hours/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/admin/catalog/route.ts", root), "utf8"),
    readFile(new URL("lib/order-catalog.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0005_many_supernaut.sql", root), "utf8"),
  ]);
  assert.match(page, /基本営業時間/);
  assert.match(page, /個別販売時間で上書き/);
  assert.match(page, /ラストオーダー/);
  assert.match(hoursApi, /Asia\/Tokyo/);
  assert.match(catalogApi, /scheduleEnabled/);
  assert.match(catalog, /product\.scheduleDays\.includes\(today\)/);
  assert.match(schema, /storeHours/);
  assert.match(migration, /CREATE TABLE `store_hours`/);
});

test("商品カード並び替え、二部営業、月別例外、ジャンル時間を共通管理する", async () => {
  const [page, catalogApi, hoursApi, categoryApi, calendarApi, catalog, migration] = await Promise.all([
    readFile(new URL("app/menu-admin/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/admin/catalog/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/admin/store-hours/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/admin/category-schedules/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/business-calendar/route.ts", root), "utf8"),
    readFile(new URL("lib/order-catalog.ts", root), "utf8"),
    readFile(new URL("drizzle/0006_powerful_betty_brant.sql", root), "utf8"),
  ]);
  assert.match(page, /draggable/);
  assert.match(page, /onDrop=\{\(\)=>reorder/);
  assert.match(page, /ランチ/);
  assert.match(page, /ディナー/);
  assert.match(page, /月別営業カレンダー/);
  assert.match(page, /お米使用メニューは土日限定/);
  assert.match(catalogApi, /Array\.isArray\(body\?\.order\)/);
  assert.match(hoursApi, /lunchStart:"11:30"/);
  assert.match(hoursApi, /dinnerStart:"17:30"/);
  assert.match(categoryApi, /categorySchedules/);
  assert.match(calendarApi, /businessCalendar/);
  assert.match(catalog, /exception\?\.status==="CLOSED"/);
  assert.match(catalog, /categoryRules\[product\.menuCategory\]/);
  assert.match(migration, /CREATE TABLE `business_calendar`/);
  assert.match(migration, /CREATE TABLE `category_schedules`/);
});

test("任意の日をイベントと無関係に通し営業へ変更できる", async () => {
  const [page, hoursApi, catalog, schema] = await Promise.all([
    readFile(new URL("app/menu-admin/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/admin/store-hours/route.ts", root), "utf8"),
    readFile(new URL("lib/order-catalog.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);
  assert.match(page, /\["CONTINUOUS","通し営業"\]/);
  assert.match(page, /continuousLastOrder/);
  assert.match(hoursApi, /"CONTINUOUS"/);
  assert.match(catalog, /exception\?\.status==="CONTINUOUS"/);
  assert.match(schema, /continuousLastOrder/);
});

test("月別営業カレンダーを日曜始まりで表示する", async () => {
  const page = await readFile(new URL("app/menu-admin/page.tsx", root), "utf8");
  assert.match(page, /lead=first\.getDay\(\)/);
  assert.match(page, /className="calendar-week"><span>日<\/span><span>月<\/span>/);
  assert.doesNotMatch(page, /lead=\(first\.getDay\(\)\+6\)%7/);
});

test("基本営業時間の保存状態をその場で表示しプレビューでも保持する", async () => {
  const [page, preview, css] = await Promise.all([
    readFile(new URL("app/menu-admin/page.tsx", root), "utf8"),
    readFile(new URL("preview/main.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(page, /hoursSaveState/);
  assert.match(page, /保存しています…/);
  assert.match(page, /再読み込み後も設定が反映されます/);
  assert.match(page, /disabled=\{hoursSaveState==="SAVING"\}/);
  assert.match(page, /aria-live="polite"/);
  assert.match(preview, /localStorage\.setItem\(previewAdminKey/);
  assert.match(preview, /previewAdminState=\{\.\.\.previewAdminState,hours:body\}/);
  assert.match(css, /\.inline-save-status\.saved/);
  assert.match(css, /@keyframes save-spin/);
});

test("既存LINE会員を安全に移行し空欄会員を新規登録へ分ける", async () => {
  const [schema, importApi, importer, membership, registration, page, lineAuth, migration] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/v1/admin/member-import/route.ts", root), "utf8"),
    readFile(new URL("scripts/import-legacy-customers.mjs", root), "utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/members/route.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("lib/member-auth.ts", root), "utf8"),
    readFile(new URL("drizzle/0008_loving_quentin_quire.sql", root), "utf8"),
  ]);
  assert.match(schema, /legacyMemberImports/);
  assert.match(schema, /pointsBalance/);
  assert.match(importApi, /MEMBER_MIGRATION_KEY/);
  assert.match(importApi, /UNREGISTERED/);
  assert.match(importer, /Dry run only/);
  assert.match(membership, /REGISTRATION_REQUIRED/);
  assert.match(membership, /points:member\.pointsBalance/);
  assert.match(registration, /randomMemberCode/);
  assert.match(registration, /acceptedTerms/);
  assert.match(page, /登録しています…/);
  assert.match(lineAuth, /oauth2\/v2\.1\/verify/);
  assert.match(lineAuth, /LINE_LOGIN_CHANNEL_ID/);
  assert.match(migration, /CREATE TABLE `legacy_member_imports`/);
  assert.match(migration, /ADD `points_balance`/);
});

test("LINE登録に必要なプライバシーポリシーと利用規約を公開する", async () => {
  const [privacy, terms] = await Promise.all([
    readFile(new URL("app/privacy/page.tsx", root), "utf8"),
    readFile(new URL("app/terms/page.tsx", root), "utf8"),
  ]);
  assert.match(privacy, /LINE User ID/);
  assert.match(privacy, /第三者提供/);
  assert.match(privacy, /開示・訂正・退会/);
  assert.match(terms, /ポイント・特典/);
  assert.match(terms, /利用停止/);
});

test("スマート決済の名称と用途別ポイント規則を共通化する", async () => {
  const [policy, schema, orders, mobileOrder, migration, readme, css] = await Promise.all([
    readFile(new URL("lib/point-policy.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/route.ts", root), "utf8"),
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("drizzle/0009_rainy_rogue.sql", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(policy, /MOBILE_ORDER/);
  assert.match(policy, /STUDIO_USAGE/);
  assert.match(policy, /purpose === "MOBILE_ORDER" \|\| purpose === "STUDIO_USAGE"/);
  assert.match(policy, /スマート決済/);
  assert.match(schema, /paymentPointEvents/);
  assert.match(schema, /RESIDENT_SUBSCRIPTION/);
  assert.match(orders, /pointRuleFor\("MOBILE_ORDER"\)/);
  assert.match(mobileOrder, /スマート決済/);
  assert.match(mobileOrder, /どちらのお支払いでもポイントが貯まります/);
  assert.match(mobileOrder, /choosingPayment/);
  assert.match(mobileOrder, /お支払い方法を選択/);
  assert.match(mobileOrder, /order\("STORE"\)/);
  assert.match(mobileOrder, /order\("STRIPE"\)/);
  assert.match(css, /:has\(\.quantity button:first-child:disabled\)/);
  assert.match(css, /content:"商品を選択"/);
  assert.match(migration, /payment_point_events/);
  assert.match(readme, /月額料金はポイント対象外/);
});

test("レシート番号を使わずフードとドリンクを別々に呼び出す", async () => {
  const [schema, orders, payment, kitchen, mobileOrder, css, migration, indexes, guide] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/payment-confirmation/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/kitchen/fulfillments/route.ts", root), "utf8"),
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("drizzle/0010_jazzy_zaladane.sql", root), "utf8"),
    readFile(new URL("drizzle/0011_mature_the_executioner.sql", root), "utf8"),
    readFile(new URL("docs/KITCHEN_CALLING_API.md", root), "utf8"),
  ]);
  assert.match(schema, /orderFulfillments/);
  assert.match(schema, /orderCallCounters/);
  assert.match(orders, /allocateCallNumber/);
  assert.match(orders, /item\.product\.category/);
  assert.match(kitchen, /START.*READY.*CALL.*PICKUP/s);
  assert.match(kitchen, /KITCHEN_API_TOKEN|requireKitchenToken/);
  assert.match(orders, /FOOD:"フード",DRINK:"ドリンク"/);
  assert.match(mobileOrder, /item\.label} 呼出番号/);
  assert.match(mobileOrder, /padStart\(3,"0"\)/);
  assert.match(css, /font:800 74px/);
  assert.match(migration, /order_fulfillments/);
  assert.match(payment, /WAITING_PAYMENT/);
  assert.match(payment, /smaregi_transaction_id/);
  assert.match(indexes, /orders_smaregi_transaction_unique/);
  assert.match(guide, /レシート番号は顧客呼出しに使用しません/);
});
