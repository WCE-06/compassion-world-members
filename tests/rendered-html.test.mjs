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

test("モバイル注文は直前メニューを即表示し商品取得を背後で更新する", async () => {
  const [page, route, catalog] = await Promise.all([
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/catalog/route.ts", root), "utf8"),
    readFile(new URL("lib/order-catalog.ts", root), "utf8"),
  ]);
  assert.match(page, /compassion-mobile-order-catalog-v1/);
  assert.match(page, /catalogSnapshot/);
  assert.match(page, /useState<Product\[\]>\(initialProducts\)/);
  assert.match(page, /localStorage\.getItem\(catalogCacheKey\)/);
  assert.match(page, /setLoading\(false\);cached=true/);
  assert.match(route, /s-maxage=300, stale-while-revalidate=900/);
  assert.match(catalog, /cacheEverything:true,cacheTtl:300/);
  assert.match(catalog, /Promise\.all/);
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

test("Stripe Checkoutを署名検証・任意保存・冪等処理付きで接続する", async () => {
  const [checkout, webhook, stripe, mobile] = await Promise.all([
    readFile(new URL("app/api/v1/orders/[id]/smart-payment/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/stripe/webhook/route.ts", root), "utf8"),
    readFile(new URL("lib/stripe.ts", root), "utf8"),
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
  ]);
  assert.match(checkout, /saved_payment_method_options/);
  assert.match(checkout, /payment_method_save/);
  assert.doesNotMatch(checkout, /saveCardConsent/);
  assert.match(webhook, /stripe_webhook_events/);
  assert.match(webhook, /payment_point_events/);
  assert.match(stripe, /HMAC/);
  assert.match(stripe, /STRIPE_WEBHOOK_SECRET/);
  assert.match(mobile, /カード入力後、次回用に保存するか選べます/);
  assert.doesNotMatch(mobile, /saveCardConsent/);
  assert.match(webhook, /savedForReuse/);
});

test("セルフレジ現地決済を未決済一覧・5分ロック・冪等通知で接続する", async () => {
  const [unpaid, lock, release, confirmation, schema, migration, guide] = await Promise.all([
    readFile(new URL("app/api/v1/orders/unpaid/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/[id]/payment-lock/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/[id]/payment-lock/release/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/payment-confirmation/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0013_steady_hedge_knight.sql", root), "utf8"),
    readFile(new URL("docs/SELF_REGISTER_ORDER_PAYMENT_API.md", root), "utf8"),
  ]);
  assert.match(unpaid, /WAITING_STORE_PAYMENT.*PAYMENT_PROCESSING/);
  assert.match(lock, /PAYMENT_LOCK_TTL_MS/);
  assert.match(lock, /PRICE_CHANGED/);
  assert.match(release, /LOCK_NOT_OWNED/);
  assert.match(confirmation, /DUPLICATE_PAYMENT_ID/);
  assert.match(confirmation, /idempotentReplay/);
  assert.match(schema, /orderPaymentLocks/);
  assert.match(migration, /order_payment_events/);
  assert.match(guide, /5分/);
});

test("磯辺揚げを調理目安3分として注文・キッチンへ引き継ぐ", async () => {
  const [catalog, orders, kitchen, migration] = await Promise.all([
    readFile(new URL("lib/order-catalog.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/kitchen/fulfillments/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0014_cute_vulture.sql", root), "utf8"),
  ]);
  assert.match(catalog, /product\.code==="isobeage"\?3:0/);
  assert.match(orders, /preparation_minutes/);
  assert.match(kitchen, /estimatedMinutes/);
  assert.match(migration, /preparation_minutes/);
});

test("会員証は施設連携を並列取得し1.5秒で本体表示を優先する", async () => {
  const [membership, facility, home] = await Promise.all([
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("lib/facility-api.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);
  assert.match(membership, /Promise\.all/);
  assert.match(membership, /1_500/);
  assert.match(facility, /AbortSignal\.timeout/);
  assert.match(home, /会員情報を確認しています/);
});

test("スマート決済後は呼出番号画面へ戻り現地決済は支払い後だけキッチン受付する", async () => {
  const [mobile, orders, kitchen, confirmation, stripe] = await Promise.all([
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/orders/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/kitchen/fulfillments/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/payment-confirmation/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/stripe/webhook/route.ts", root), "utf8"),
  ]);
  assert.match(mobile, /payment!=="success"/);
  assert.match(mobile, /orderId=.*encodeURIComponent/);
  assert.match(mobile, /お支払い・ご注文を受け付けました/);
  assert.match(orders, /request\.nextUrl\.searchParams\.get\("orderId"\)/);
  assert.match(kitchen, /status IN \('ACCEPTED','COOKING','READY','CALLED'\)/);
  assert.doesNotMatch(kitchen, /WAITING_PAYMENT.*ORDER BY/);
  assert.match(confirmation, /UPDATE order_fulfillments SET status='ACCEPTED'/);
  assert.match(stripe, /UPDATE order_fulfillments SET status='ACCEPTED'/);
});

test("現地決済は商品同期遅延で固まらず同じ注文を安全に再試行する", async () => {
  const [mobile, catalog, orders] = await Promise.all([
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("lib/order-catalog.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/route.ts", root), "utf8"),
  ]);
  assert.match(catalog, /AbortSignal\.timeout/);
  assert.match(catalog, /SNAPSHOT_FALLBACK/);
  assert.match(orders, /timeoutMs:3_000,allowSnapshotFallback:true/);
  assert.match(mobile, /AbortSignal\.timeout\(10_000\)/);
  assert.match(mobile, /compassion-pending-order-request/);
  assert.match(mobile, /finally\{progressTimers\.forEach\(clearTimeout\);setSending\(false\)\}/);
  assert.match(mobile, /注文は重複しません/);
  assert.match(mobile, /商品情報と金額を確認しています/);
  assert.match(mobile, /現地決済の受付番号を発行しています/);
  assert.match(mobile, /15分以内にセルフレジでお支払いください/);
  assert.doesNotMatch(mobile, /キッチンへ注文は送信されません/);
});

test("現地決済は15分後に注文と呼出情報を自動取消する", async () => {
  const [mobile, orders, membership, pos] = await Promise.all([
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/orders/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("lib/order-pos.ts", root), "utf8"),
  ]);
  assert.match(orders, /15 \* 60_000/);
  assert.match(orders, /expireStaleOrder\(\)/);
  assert.match(membership, /expireStaleOrder\(\)/);
  assert.match(pos, /status='EXPIRED'/);
  assert.match(pos, /status='CANCELLED'/);
  assert.match(mobile, /remaining\+250/);
  assert.match(mobile, /お支払い期限を過ぎました/);
});

test("提供予定はキッチン計算を正本としセルフレジへ部門別呼出番号を渡す", async () => {
  const [mobile, orders, schedule, pos, confirmation, stripe] = await Promise.all([
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/orders/route.ts", root), "utf8"),
    readFile(new URL("lib/kitchen-schedule.ts", root), "utf8"),
    readFile(new URL("lib/order-pos.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/payment-confirmation/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/stripe/webhook/route.ts", root), "utf8"),
  ]);
  assert.doesNotMatch(mobile, /Date\.now\(\)\+30\*60_000/);
  assert.match(mobile, /提供予定：できあがり次第/);
  assert.match(orders, /estimateOrderSchedule/);
  assert.match(schedule, /WITH_FOOD/);
  assert.match(schedule, /AbortSignal\.timeout\(2_500\)/);
  assert.match(pos, /foodCallNumber/);
  assert.match(pos, /drinkCallNumber/);
  assert.match(confirmation, /confirmOrderSchedule\(orderId/);
  assert.match(stripe, /confirmOrderSchedule\(metadata\.order_id/);
});

test("モバイル注文のカテゴリタブが商品追加ボタンと重ならない", async () => {
  const [layout, fix] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/mobile-order-fixes.css", root), "utf8"),
  ]);
  assert.match(layout, /mobile-order-fixes\.css/);
  assert.match(fix, /\.product-list article\s*\{[^}]*position:\s*relative/s);
});

test("提供予定をキッチン正本へ統一し固定30分を使用しない", async () => {
  const [mobile,orders,estimate,payment,stripe,membership,schedule] = await Promise.all([
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/orders/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/estimate/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/payment-confirmation/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/stripe/webhook/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("lib/kitchen-schedule.ts", root), "utf8"),
  ]);
  assert.doesNotMatch(mobile, /30\s*\*\s*60_000/);
  assert.match(mobile, /\/api\/v1\/orders\/estimate/);
  assert.match(orders, /estimateOrderSchedule/);
  assert.match(estimate, /estimateOrderSchedule/);
  assert.match(payment, /confirmOrderSchedule/);
  assert.match(stripe, /confirmOrderSchedule/);
  assert.match(membership, /scheduleLabel/);
  assert.match(schedule, /getOrderSchedule/);
});

test("初回登録・既存会員移行・会員サービス詳細を実画面として提供する", async () => {
  const [page,links,registration,members,css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/membership-links/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/me/registration/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/members/route.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.doesNotMatch(page, /共通システムとの接続準備中です/);
  assert.match(page, /ServiceSheet/);
  assert.match(page, /現在利用できるクーポンはありません/);
  assert.match(page, /\/api\/v1\/me\/registration/);
  assert.match(page, /\/api\/v1\/membership-links/);
  assert.match(links, /authenticatedLineUserId/);
  assert.match(links, /MEMBER_VERIFICATION_FAILED/);
  assert.match(registration, /legacy_member_imports/);
  assert.match(members, /randomMemberCode/);
  assert.match(css, /member-sheet-backdrop/);
});

test("会員ランクを利用実績で6段階化し住民のゴールド保証と最大10パーセント還元を行う", async () => {
  const [page,membership,ranks,points,schema,css,memberImport,residentApi,migration] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("lib/member-rank.ts", root), "utf8"),
    readFile(new URL("lib/point-return-policy.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/api/v1/admin/member-import/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/admin/resident-status/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0015_early_wild_child.sql", root), "utf8"),
  ]);
  for(const rank of ["STANDARD","BRONZE","SILVER","GOLD","PLATINUM","DIAMOND"])assert.match(ranks,new RegExp(rank));
  assert.match(ranks, /storedRank==="RESIDENT"/);
  assert.match(ranks, /residentFloor=MEMBER_RANKS.indexOf\("GOLD"\)/);
  for(const amount of ["30_000","60_000","120_000","180_000","300_000"])assert.match(ranks,new RegExp(amount));
  for(const rate of [1,2,3,5,7,10])assert.match(ranks,new RegExp(`pointRatePercent:${rate}`));
  assert.match(page, /次の\{member.nextRankLabel\}まで/);
  assert.match(page, /ランク還元率/);
  assert.match(page, /スマレジへのポイント反映は接続準備中です/);
  assert.match(page, /rank-card-\$\{member\.rank\.toLowerCase\(\)\}/);
  assert.match(page, /rank-emblem/);
  assert.match(membership, /memberPresentation/);
  assert.match(membership, /365\*24\*60\*60\*1000/);
  assert.match(membership, /unit_price_excluding_tax\*i.quantity/);
  assert.match(page, /rank-ladder/);
  assert.match(page, /resident-badge/);
  assert.match(points, /MINIMUM_MARGIN_BPS=0/);
  assert.match(points, /sellingPriceExcludingTax/);
  assert.match(schema, /"DIAMOND"/);
  assert.match(schema, /residentStatus/);
  assert.match(ranks, /includes\("住民登録証"\)/);
  assert.match(ranks, /includes\("通行許可証"\)/);
  assert.match(memberImport, /UNKNOWN_MEMBERSHIP_TYPE/);
  assert.match(memberImport, /resident_status=excluded\.resident_status/);
  assert.match(residentApi, /MEMBER_MIGRATION_KEY/);
  assert.match(residentApi, /resident_status=\?/);
  assert.match(membership, /LEGACY_RESIDENT_MEMBER_CODES/);
  assert.match(migration, /resident_status/);
  assert.match(css, /rank-diamond/);
  for(const rank of ["standard","bronze","silver","gold","platinum","diamond"])assert.match(css,new RegExp(`rank-card-${rank}`));
});

test("スマレジの直近365日集計を正本として会員証とセルフレジへ安全に共有する", async () => {
  const [membership,syncApi,benefitApi,migration,handoff] = await Promise.all([
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/admin/smaregi-spend-sync/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/pos/member-benefit/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0016_tearful_randall.sql", root), "utf8"),
    readFile(new URL("docs/SMAREGI_RANK_AND_POINT_HANDOFF.md", root), "utf8"),
  ]);
  assert.match(migration, /CREATE TABLE `member_spend_snapshots`/);
  assert.match(membership, /smaregiSpend\?\.qualifyingSpend\?\?localSpend/);
  assert.match(syncApi, /MEMBER_MIGRATION_KEY/);
  assert.match(syncApi, /spanDays<360\|\|spanDays>370/);
  assert.match(syncApi, /ON CONFLICT\(member_id\) DO UPDATE/);
  assert.match(benefitApi, /requirePosToken/);
  assert.match(benefitApi, /memberPresentation/);
  assert.match(handoff, /二重計上しない/);
  assert.match(handoff, /月額住民登録料はポイント対象外/);
});

test("新規登録完了後に発行済み会員証へ遷移する", async () => {
  const [page,members] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/members/route.ts", root), "utf8"),
  ]);
  assert.match(page, /COMPASSION WORLDへの入館/);
  assert.doesNotMatch(page, /SMS認証は現在使用しません/);
  assert.match(page, /setMember\(await membership\.json\(\)\);setView\("member"\)/);
  assert.match(page, /新しいポイントカードを発行しました/);
  assert.match(members, /randomMemberCode/);
  assert.match(members, /INSERT INTO identity_links/);
  assert.match(members, /status:201/);
});
