import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {jstDateInput,jstMonthInput} from "../lib/jst-date.ts";

const root = new URL("../", import.meta.url);

test("日本時間の日付・月境界を管理画面で使用する", async () => {
  const boundary=new Date("2026-08-31T15:30:00Z");
  assert.equal(jstDateInput(boundary),"2026-09-01");
  assert.equal(jstMonthInput(boundary),"2026-09");
  const [menuAdmin,reservations,overview]=await Promise.all([
    readFile(new URL("app/menu-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/studio/reservations/route.ts",root),"utf8"),
    readFile(new URL("app/member-admin/StudioReservationOverview.tsx",root),"utf8"),
  ]);
  assert.match(menuAdmin,/useState\(jstMonthInput\)/);
  assert.match(reservations,/jstDateInput\(\)/);
  assert.match(overview,/useState\(jstDateInput\(today\)\)/);
});

test("同時決済通知は勝者の決済IDだけを記録する", async () => {
  const route=await readFile(new URL("app/api/v1/orders/payment-confirmation/route.ts",root),"utf8");
  assert.match(route,/INSERT INTO order_payment_events[\s\S]*SELECT[\s\S]*smaregi_transaction_id=\?/);
  assert.match(route,/confirmed\.paymentId!==paymentId/);
});

test("Stripe決済画面の二重生成と遅延通知によるKitchen誤受付を防ぐ", async () => {
  const [checkout,webhook,stripe]=await Promise.all([
    readFile(new URL("app/api/v1/orders/[id]/smart-payment/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/stripe/webhook/route.ts",root),"utf8"),
    readFile(new URL("lib/stripe.ts",root),"utf8"),
  ]);
  assert.match(stripe,/Idempotency-Key/);
  assert.match(checkout,/`mobile-order:\$\{id\}`/);
  assert.match(checkout,/`customer:\$\{member\.id\}`/);
  assert.match(webhook,/stripe_payment_intent_id=\?/);
  assert.match(webhook,/ORDER_PAYMENT_CONFLICT/);
});

test("同じ注文リクエストIDで内容を変えた再送を拒否する",async()=>{
  const route=await readFile(new URL("app/api/v1/orders/route.ts",root),"utf8");
  assert.match(route,/member_id AS memberId/);
  assert.match(route,/existing\.memberId!==member\.id/);
  assert.match(route,/existingKey!==requestedKey/);
  assert.match(route,/ORDER_REQUEST_CONFLICT/);
});

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
  assert.match(page, /window\.location\.href="\/availability"/);
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

test("予約・利用情報は認証会員本人の会員番号で再検証する", async () => {
  const [facilityApi, membershipApi, reservationsApi, cancellationApi] = await Promise.all([
    readFile(new URL("lib/facility-api.ts", root), "utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/reservations/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/reservations/[id]/route.ts", root), "utf8"),
  ]);
  assert.match(facilityApi, /filterOwnedFacilityRows/);
  assert.match(facilityApi, /normalizeFacilityMemberCode\(row\.memberCode\) === expected/);
  assert.match(membershipApi, /filterOwnedFacilityRows\(reservationResult\.rows\?\?\[\],member\.memberCode\)/);
  assert.match(membershipApi, /isOwnedFacilityRow\(sessionResult\.data\.session,member\.memberCode\)/);
  assert.match(reservationsApi, /filterOwnedFacilityRows\(rows, member\.memberCode\)/);
  assert.match(cancellationApi, /memberCode:member\.memberCode/);
  assert.match(cancellationApi, /facilityId:"FEBBRAIO"/);
});

test("予約台帳の一時障害を予約なしとして表示しない", async () => {
  const [membershipApi, page] = await Promise.all([
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);
  assert.match(membershipApi, /reservation\.get[\s\S]*8_000/);
  assert.match(membershipApi, /membership reservation\.get failed/);
  assert.match(membershipApi, /const reservationsAvailable=reservationResult\.rows!==null/);
  assert.match(membershipApi, /Object\.assign\(presentation,\{reservationsAvailable\}\)/);
  assert.match(page, /member\.reservationsAvailable===false/);
  assert.match(page, /一時的なエラーで予約情報を確認できませんでした/);
  assert.match(page, /member\.reservationsAvailable!==false&&!member\.session/);
});

test("予約ページは代表会員へフォールバックせずLINE本人の履歴だけを取得する", async () => {
  const [page, reservationsApi, cancellationApi] = await Promise.all([
    readFile(new URL("app/availability/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/reservations/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/reservations/[id]/route.ts", root), "utf8"),
  ]);
  assert.doesNotMatch(page, /X-Compass-Preview/);
  assert.match(page, /スタジオ予約/);
  assert.match(page, /「分」を15分単位で選択できます/);
  assert.match(page, /何時から利用しますか/);
  assert.match(page, /何分からですか/);
  assert.match(page, /minuteLabel/);
  assert.match(page, /fetch\("\/api\/v1\/reservations"/);
  assert.match(reservationsApi, /LINE_AUTH_REQUIRED/);
  assert.match(cancellationApi, /LINE_AUTH_REQUIRED/);
});

test("読み込み中の仮通知を表示せず無料会員を住民登録へ案内する", async () => {
  const [page, residentPage, upgradeApi] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/resident/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/resident-upgrade/route.ts", root), "utf8"),
  ]);
  assert.match(page, /view === "member" \? member\.notices/);
  assert.match(page, /member\.membershipType!=="RESIDENT"/);
  assert.match(page, /住民登録へアップグレード/);
  assert.match(residentPage, /ゴールドランク以上を保証/);
  assert.match(upgradeApi, /RESIDENT_SUBSCRIPTION_CHECKOUT_URL/);
  assert.match(upgradeApi, /client_reference_id/);
});

test("予約導線は外部サイトへ移動せず会員証と同一サイト内で完結する", async () => {
  const [page, bookingPage] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/availability/page.tsx", root), "utf8"),
  ]);
  assert.match(page, /window\.location\.href="\/availability"/);
  assert.doesNotMatch(page, /exchangeUrl|form\.method="POST"/);
  assert.doesNotMatch(bookingPage, /chatgpt\.site|febbraio\/launch|exchangeUrl/);
  assert.match(bookingPage, /15分単位/);
  assert.match(bookingPage, /startAt:new Date\(selected\.startAt\)\.toISOString\(\)/);
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
  assert.match(route, /s-maxage=60, stale-while-revalidate=120/);
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
  assert.match(page, /entry === "join" \? "new" : "unlinked"/);
  assert.match(page, /params\.get\("entry"\)/);
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
  assert.match(orders, /allocateKitchenUnitNumber/);
  assert.match(orders, /unitRows/);
  assert.match(orders, /'WAITING_PAYMENT'/);
  assert.match(orders, /item\.product\.category/);
  assert.match(kitchen, /START.*READY.*CALL.*PICKUP/s);
  assert.match(kitchen, /KITCHEN_API_TOKEN|requireKitchenToken/);
  assert.match(orders, /FOOD:"フード",DRINK:"ドリンク"/);
  assert.match(mobileOrder, /displayUnits\(complete\)/);
  assert.match(mobileOrder, /padStart\(3,"0"\)/);
  assert.match(css, /font:800 74px/);
  assert.match(migration, /order_fulfillments/);
  assert.match(payment, /WAITING_PAYMENT/);
  assert.match(payment, /smaregi_transaction_id/);
  assert.match(indexes, /orders_smaregi_transaction_unique/);
  assert.match(guide, /レシート番号は顧客呼出しに使用しません/);
});

test("商品単位の呼出番号を注文・決済・会員証・セルフレジで共有する", async () => {
  const [orders, units, payment, stripe, pos, membership, mobile, memberPage, migration] = await Promise.all([
    readFile(new URL("app/api/v1/orders/route.ts", root), "utf8"),
    readFile(new URL("lib/kitchen-units.ts", root), "utf8"),
    readFile(new URL("app/api/v1/orders/payment-confirmation/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/stripe/webhook/route.ts", root), "utf8"),
    readFile(new URL("lib/order-pos.ts", root), "utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("app/mobile-order/page.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("drizzle/0032_mobile_order_item_units.sql", root), "utf8"),
  ]);
  assert.match(orders, /unitIndex<=item\.quantity/);
  assert.match(orders, /kitchen_units.*WAITING_PAYMENT/s);
  assert.match(orders, /orderUnits\(id\)/);
  assert.match(units, /kitchen_unit_counters/);
  assert.doesNotMatch(orders, /INSERT INTO order_call_counters/);
  assert.match(payment, /UPDATE kitchen_units SET status='ACCEPTED'/);
  assert.match(stripe, /UPDATE kitchen_units SET status='ACCEPTED'/);
  assert.match(pos, /units/);
  assert.match(membership, /units:await orderUnits/);
  assert.match(mobile, /displayUnits\(complete\)/);
  assert.match(memberPage, /function orderHeadline/);
  assert.match(memberPage, /unit\.callNumberLabel/);
  assert.match(memberPage, /一部の商品ができあがりました/);
  assert.match(mobile, /できあがった商品から個別に呼び出します/);
  assert.match(memberPage, /orderCallSummary/);
  assert.match(migration, /MOBILE_ORDER_ITEM_UNIT_MIGRATION/);
  assert.match(migration, /kitchen_test_orders/);
  assert.match(migration, /smaregi_transaction_id IS NULL/);
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
  assert.match(unpaid, /normalize\("NFKC"\)/);
  assert.match(unpaid, /o\.expires_at>\?/);
  assert.match(unpaid, /Cache-Control.*no-store/);
  assert.match(unpaid, /memberCode,queriedAt/);
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

test("会員証は施設連携を並列取得し受付状態を安全に確認する", async () => {
  const [membership, facility, home] = await Promise.all([
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("lib/facility-api.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);
  assert.match(membership, /Promise\.all/);
  assert.match(membership, /6_000/);
  assert.match(facility, /AbortSignal\.timeout/);
  assert.match(home, /会員情報を確認しています/);
});

test("会員証コードを最優先表示し詳細情報を背後で読み込む",async()=>{
  const [card,home,auth]=await Promise.all([
    readFile(new URL("app/api/v1/me/card/route.ts",root),"utf8"),
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("lib/member-auth.ts",root),"utf8"),
  ]);
  assert.match(card,/points_balance AS points/);
  assert.doesNotMatch(card,/facilityPost|reservation\.get|order_items|member_notifications/);
  assert.match(home,/fetch\("\/api\/v1\/me\/card"/);
  assert.match(home,/setView\("member"\)[\s\S]*fetch\("\/api\/v1\/me\/membership"/);
  assert.match(home,/予約・注文・お知らせを読み込んでいます/);
  assert.match(auth,/Promise\.all/);
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
  assert.match(mobile, /提供予定時間を確認しています。しばらくお待ちください。/);
  assert.match(orders, /estimateOrderSchedule/);
  assert.match(schedule, /WITH_FOOD/);
  assert.match(schedule, /AbortSignal\.timeout\(7_000\)/);
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
  assert.match(membership, /member_spend_snapshots/);
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
  const [membership,home,syncApi,benefitApi,migration,handoff] = await Promise.all([
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/v1/admin/smaregi-spend-sync/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/pos/member-benefit/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0016_tearful_randall.sql", root), "utf8"),
    readFile(new URL("docs/SMAREGI_RANK_AND_POINT_HANDOFF.md", root), "utf8"),
  ]);
  assert.match(migration, /CREATE TABLE `member_spend_snapshots`/);
  assert.match(membership, /smaregiSpend\?\.qualifyingSpend\?\?0/);
  assert.match(membership, /smaregiSpend\?"SMAREGI":"NOT_SYNCED"/);
  assert.doesNotMatch(membership, /localSpend/);
  assert.match(home, /年間購入額をスマレジから集計しています/);
  assert.match(home, /一部の購入額を年間実績として表示しません/);
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
  assert.match(page, /const registered=await membership\.json\(\);setMember\(registered\);setView\("member"\)/);
  assert.match(page, /会員番号を発行しています/);
  assert.match(members, /randomMemberCode/);
  assert.match(members, /INSERT INTO identity_links/);
  assert.match(members, /status:201/);
});

test("受渡済みの部門注文を会員証へ残さず注文全体も自動修復する", async () => {
  const [membership,kitchen,pos] = await Promise.all([
    readFile(new URL("app/api/v1/me/membership/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/kitchen/fulfillments/route.ts", root), "utf8"),
    readFile(new URL("lib/order-pos.ts", root), "utf8"),
  ]);
  assert.match(membership,/reconcileCompletedOrders\(member\.id\)/);
  assert.match(membership,/filter\(Boolean\)\.every\(status=>status==="PICKED_UP"\|\|status==="CANCELLED"\)/);
  assert.match(pos,/UPDATE orders SET status='PICKED_UP'/);
  assert.doesNotMatch(kitchen,/existing\.status!==rule\.to[^}]+return NextResponse\.json\(\{id:fulfillmentId/s);
  assert.match(kitchen,/values\.every\(status=>status==="PICKED_UP"\)\?"PICKED_UP"/);
});

test("未完了の予約と注文をすべて表示し完了分を履歴へ分離する", async () => {
  const [page,membership,notices]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts",root),"utf8"),
    readFile(new URL("lib/member-notices.ts",root),"utf8"),
  ]);
  assert.match(page,/ご利用予定・受付状況/);
  assert.match(page,/activeReservations\.map/);
  assert.match(page,/activeOrders\.map/);
  assert.match(page,/activity-create-actions-bottom/);
  assert.doesNotMatch(page,/予約・Aozora Kitchen注文/);
  assert.match(membership,/reservationHistory/);
  assert.match(membership,/no-show:/);
  assert.match(membership,/Date\.parse\(row\.startAt\)<=noShowCutoff/);
  assert.match(membership,/sessionResult\.error===null/);
  assert.match(membership,/orderHistory/);
  assert.match(membership,/totalIncludingTax/);
  assert.match(membership,/paymentLabel/);
  assert.match(membership,/orderItemRows/);
  assert.match(page,/function UsageHistory/);
  assert.match(page,/獲得ポイント/);
  assert.match(membership,/memberNotices\(notificationRows\.results,member\)/);
  assert.match(notices,/新しいポイントカードのご利用ありがとうございます/);
  assert.match(membership,/cardStartedAt/);
});

test("スタッフ統合管理からスタジオ予約と手動受付を共通台帳へ反映する", async () => {
  const [page,api]=await Promise.all([
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/studio/route.ts",root),"utf8"),
  ]);
  assert.match(page,/統合会員管理/);
  assert.match(page,/スタジオ予約・受付/);
  assert.match(page,/スタッフ予約を登録/);
  assert.match(page,/予約なしで今すぐ受付/);
  assert.match(api,/facility\.session\.start/);
  assert.match(api,/reservation\.create/);
  assert.match(api,/reservation\.cancel/);
  assert.match(api,/ADMIN_EMAILS/);
  assert.match(api,/STAFF_STUDIO_/);
});

test("スタッフが会員詳細を安全に編集し操作履歴を確認できる", async () => {
  const [list,detail,api]=await Promise.all([
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/members/[memberCode]/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/members/[memberCode]/route.ts",root),"utf8"),
  ]);
  assert.match(list,/詳細・編集/);
  assert.match(detail,/基本情報/);
  assert.match(detail,/操作履歴/);
  assert.match(detail,/外部連携/);
  assert.match(api,/REVISION_CONFLICT/);
  assert.match(api,/MEMBER_PROFILE_UPDATED/);
  assert.match(api,/changedFields/);
  assert.doesNotMatch(api,/provider_user_id AS/);
});

test("LメンバーズのLINE名・追加経路・タグを移行後も保持する", async () => {
  const [schema,importer,api,detail]=await Promise.all([
    readFile(new URL("db/schema.ts",root),"utf8"),
    readFile(new URL("scripts/import-member-completion.mjs",root),"utf8"),
    readFile(new URL("app/api/v1/admin/member-csv-import/route.ts",root),"utf8"),
    readFile(new URL("app/member-admin/members/[memberCode]/page.tsx",root),"utf8"),
  ]);
  assert.match(schema,/line_display_name/);assert.match(schema,/acquisition_source/);assert.match(schema,/legacy_tags/);
  assert.match(importer,/value\(row,"LINE名"\)/);assert.match(importer,/value\(row,"追加経路"\)/);assert.match(importer,/value\(row,"タグ"\)/);
  assert.match(api,/line_display_name/);assert.match(api,/acquisition_source/);assert.match(api,/legacy_tags/);
  assert.match(detail,/LINE名/);assert.match(detail,/追加経路/);assert.match(detail,/タグ/);
});

test("スタッフ管理をLメンバーズ型の検索と個人履歴タブへ拡張する", async () => {
  const [list,detail,listApi,detailApi]=await Promise.all([
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/members/[memberCode]/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/members/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/members/[memberCode]/route.ts",root),"utf8"),
  ]);
  assert.match(list,/全ランク/);assert.match(list,/タグ/);assert.match(list,/追加経路/);assert.match(list,/LINE連携/);
  assert.match(listApi,/line_display_name/);assert.match(listApi,/legacy_tags/);assert.match(listApi,/acquisition_source/);
  assert.match(detail,/予約・受付/);assert.match(detail,/ポイント・特典/);assert.match(detail,/サブスク・決済/);assert.match(detail,/操作履歴/);
  assert.match(detailApi,/FROM orders WHERE member_id/);assert.match(detailApi,/FROM payment_point_events WHERE member_id/);assert.match(detailApi,/FROM stripe_customers WHERE member_id/);
  assert.match(list,/登録日が新しい順/);assert.match(list,/利用金額が多い順/);assert.match(list,/保有ポイントが多い順/);
  assert.match(listApi,/POINTS_DESC/);assert.match(listApi,/SPEND_DESC/);assert.match(listApi,/m\.points_balance/);
});

test("スタッフ手動予約は内容確認後に確定し処理中を明示する", async () => {
  const page=await readFile(new URL("app/member-admin/page.tsx",root),"utf8");
  assert.match(page,/この内容で予約しますか？/);
  assert.match(page,/この内容で予約を確定/);
  assert.match(page,/予約登録を開始しました/);
  assert.match(page,/登録処理中…/);
  assert.match(page,/if\(action==="CREATE_RESERVATION"\)setReservationConfirm\(false\)/);
});

test("管理者パスワード変更と会員データ同期を安全に提供する", async () => {
  const [page,session,passwordApi,syncApi,memberAuth,migration]=await Promise.all([
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("lib/admin-session.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/auth/password/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/sync-center/route.ts",root),"utf8"),
    readFile(new URL("lib/member-auth.ts",root),"utf8"),
    readFile(new URL("drizzle/0019_admin_accounts.sql",root),"utf8"),
  ]);
  assert.match(page,/管理者パスワード変更/);assert.match(page,/全員の対象額を一回だけ再計算/);
  assert.match(session,/PBKDF2/);assert.match(session,/admin_accounts/);
  assert.match(passwordApi,/PASSWORD_POLICY/);assert.match(passwordApi,/verifyAdminPassword/);
  assert.match(passwordApi,/Promise\.all/);assert.match(passwordApi,/Server-Timing/);
  assert.match(passwordApi,/\\x21-\\x7E/);assert.match(page,/10文字以上で英字と数字を両方含めてください。記号も使用できます/);
  assert.match(session,/pbkdf2_sha256_120000/);assert.match(session,/pbkdf2_sha256_210000/);
  assert.match(session,/pbkdf2_sha256_30000_peppered/);assert.match(session,/peppered/);
  assert.match(session,/upgradeLegacyPassword/);assert.match(session,/valid&&peppered/);
  assert.match(syncApi,/LINE_NAMES/);assert.match(syncApi,/SPEND_RECALC/);assert.match(syncApi,/LINE_CHANNEL_ACCESS_TOKEN/);assert.match(syncApi,/SMAREGI_SPEND_RECALC_URL/);
  assert.match(syncApi,/loyaltyAnnualSpendSync/);assert.match(syncApi,/ALL_ACTIVE_MEMBERS_ONCE/);
  assert.match(syncApi,/loyaltyAnnualSpendSyncStatus/);assert.match(page,/初回同期の状態/);assert.match(page,/対象額を集計中/);
  assert.match(page,/残りを確認しています/);assert.match(page,/result\.hasMore/);
  assert.match(page,/AbortSignal\.timeout\(30000\)/);assert.match(page,/finally\{setBusy\(\"\"\)\}/);
  assert.match(memberAuth,/line_display_name/);assert.match(memberAuth,/profile\.displayName/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS `?admin_accounts`?/);
});

test("統合管理でタスク・予約一覧・クーポン・配信・会員一括操作を管理する",async()=>{
  const [page,sidebar,tasks,reservations,engagement,bulk,migration]=await Promise.all([
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/AdminSidebar.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/tasks/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/studio/reservations/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/engagement/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/members/bulk/route.ts",root),"utf8"),
    readFile(new URL("drizzle/0020_operations_console.sql",root),"utf8"),
  ]);
  assert.match(sidebar,/SNSコントロール/);assert.match(sidebar,/精算・売上/);assert.match(sidebar,/在庫確認/);assert.match(sidebar,/作業タスク/);
  assert.match(sidebar,/AdminMobileNav/);assert.match(sidebar,/スマートフォン用管理メニュー/);assert.match(page,/AdminMobileNav/);
  assert.match(page,/StudioReservationOverview/);assert.match(reservations,/staff\.reservations\.list/);
  assert.match(tasks,/operations_tasks/);assert.match(engagement,/message_campaigns/);assert.match(engagement,/automation_rules/);
  assert.match(page,/BulkMemberActions/);assert.match(bulk,/MEMBER_TAG_ADDED/);assert.match(bulk,/MEMBER_STATUS_CHANGED/);
  assert.match(migration,/CREATE TABLE `coupons`/);assert.match(migration,/CREATE TABLE `surveys`/);assert.match(migration,/CREATE TABLE `operations_tasks`/);
});

test("管理画面は概要と詳細を分離し検索入力を待ってから取得する",async()=>{
  const [page,api]=await Promise.all([
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/members/route.ts",root),"utf8"),
  ]);
  assert.match(page,/mode:\"SUMMARY\"/);
  assert.match(page,/setTimeout/);
  assert.match(page,/250/);
  assert.match(api,/p\.get\(\"mode\"\)===\"SUMMARY\"/);
});

test("商品マスタ登録と販売期間を共通商品管理へ追加する",async()=>{
  const [route,component,catalog,migration,menu,guide,admin,workspace]=await Promise.all([
    readFile(new URL("app/api/v1/admin/product-master/route.ts",root),"utf8"),
    readFile(new URL("app/menu-admin/ProductMasterRegistration.tsx",root),"utf8"),
    readFile(new URL("lib/order-catalog.ts",root),"utf8"),
    readFile(new URL("drizzle/0022_catalog_sale_period.sql",root),"utf8"),
    readFile(new URL("app/menu-admin/page.tsx",root),"utf8"),
    readFile(new URL("docs/COUPON_AND_PRODUCT_MASTER_OPERATIONS.md",root),"utf8"),
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/menu-admin/ProductMasterWorkspace.tsx",root),"utf8"),
  ]);
  assert.match(route,/SMAREGI_PRODUCT_MASTER_URL/);assert.match(route,/product\.create/);assert.match(route,/product\.update/);assert.match(route,/product\.status/);assert.match(route,/Idempotency-Key/);
  assert.match(component,/スマレジ商品マスタ/);assert.match(component,/販売を停止/);assert.match(component,/ポイント付与対象/);assert.match(component,/JANコード/);
  assert.match(component,/5分ごとに自動更新/);assert.match(component,/販売開始/);assert.match(component,/販売終了/);
  assert.match(catalog,/saleWindowOpen/);assert.match(migration,/sale_starts_at/);assert.match(migration,/sale_ends_at/);
  assert.match(menu,/ProductMasterRegistration/);
  assert.match(admin,/ProductMasterWorkspace allowCreate/);assert.match(workspace,/allowCreate&&<ProductMasterRegistration/);
  assert.match(guide,/予約/);assert.match(guide,/確定/);assert.match(guide,/値引き用JAN/);
});

test("スタッフ予約一覧は共通施設APIの専用認証を使用する",async()=>{
  const [facility,operations]=await Promise.all([
    readFile(new URL("lib/facility-api.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/operations/route.ts",root),"utf8"),
  ]);
  assert.match(facility,/action\.startsWith\(\"staff\.\"\)/);
  assert.match(facility,/FACILITY_STAFF_API_TOKEN/);
  assert.match(operations,/COMMON_FACILITY_GAS_URL&&\(runtime\.FACILITY_STAFF_API_TOKEN\|\|runtime\.FACILITY_API_TOKEN\)/);
});

test("管理画面の外部同期は待ち続けずLINE名を並列取得する",async()=>{
  const [sync,page,studio,members,operations]=await Promise.all([
    readFile(new URL("app/api/v1/admin/sync-center/route.ts",root),"utf8"),
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/StudioReservationOverview.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/members/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/operations/route.ts",root),"utf8"),
  ]);
  assert.match(sync,/Promise\.all\(rows\.results\.map/);assert.match(sync,/AbortSignal\.timeout\(4000\)/);assert.match(sync,/env\.DB\.batch/);
  assert.match(sync,/AbortSignal\.timeout\(3000\)/);assert.match(sync,/AbortSignal\.timeout\(5000\)/);
  assert.match(page,/memberRequest=useRef/);assert.match(page,/AbortSignal\.timeout\(8000\)/);assert.match(page,/AbortSignal\.timeout\(10000\)/);
  assert.match(studio,/requestId=useRef/);assert.match(studio,/AbortSignal\.timeout\(8000\)/);
  assert.match(members,/private, max-age=10, stale-while-revalidate=30/);
  assert.match(operations,/Cache-Control":"no-store/);
});

test("管理ダッシュボードは完了済みタスクと期限切れ決済を障害扱いしない",async()=>{
  const [operations,tasks,taskPanel,webhook,migration]=await Promise.all([
    readFile(new URL("app/api/v1/admin/operations/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/tasks/route.ts",root),"utf8"),
    readFile(new URL("app/member-admin/TaskPanel.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/stripe/webhook/route.ts",root),"utf8"),
    readFile(new URL("drizzle/0026_cleanup_cancelled_orders.sql",root),"utf8"),
  ]);
  assert.match(operations,/stripe_webhook_events WHERE status='FAILED'/);
  assert.doesNotMatch(operations,/orders WHERE status='PAYMENT_FAILED'/);
  assert.match(tasks,/get\("status"\)\?\?"ACTIVE"/);
  assert.match(tasks,/status NOT IN \('DONE','CANCELLED'\)/);
  assert.match(taskPanel,/useState\("ACTIVE"\)/);
  assert.match(taskPanel,/対応が必要/);
  assert.match(webhook,/UPDATE orders SET status='CANCELLED'/);
  assert.match(migration,/SET `status`='CANCELLED'/);
});
test("スタッフ管理の全主要APIはパスワードログインを共通認証として受け入れる",async()=>{
  for(const file of ["operations/route.ts","engagement/route.ts","tasks/route.ts","members/route.ts","studio/route.ts","catalog/route.ts","store-hours/route.ts"]){
    const source=await readFile(new URL(`app/api/v1/admin/${file}`,root),"utf8");
    assert.match(source,/requireAdminSession/);
    assert.match(source,/await requireAdminSession\(request\)/);
  }
  const [operations,engagement,tasks]=await Promise.all([
    readFile(new URL("app/member-admin/OperationsPanels.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/EngagementPanel.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/TaskPanel.tsx",root),"utf8"),
  ]);
  assert.match(operations,/AbortSignal\.timeout\(8000\)/);
  assert.match(operations,/もう一度読み込む/);
  assert.match(engagement,/AbortSignal\.timeout\(8000\)/);
  assert.match(tasks,/AbortSignal\.timeout\(8000\)/);
});

test("スマレジ商品マスタ全件を同期し商品別に在庫管理対象外を設定できる",async()=>{
  const [route,panel,migration,styles]=await Promise.all([
    readFile(new URL("app/api/v1/admin/inventory/route.ts",root),"utf8"),
    readFile(new URL("app/member-admin/InventoryPanel.tsx",root),"utf8"),
    readFile(new URL("drizzle/0024_inventory_product_settings.sql",root),"utf8"),
    readFile(new URL("app/member-admin/member-admin.css",root),"utf8"),
  ]);
  assert.match(route,/result\.products/);
  assert.match(route,/SET_TRACKING/);
  assert.match(route,/WHERE p\.inventory_managed=1/);
  assert.match(route,/INVENTORY_NOT_MANAGED/);
  assert.match(panel,/商品マスタ・実在庫を更新/);
  assert.match(panel,/在庫を管理する/);
  assert.match(panel,/在庫管理対象外/);
  assert.match(panel,/inventory-product-name/);assert.match(styles,/Product and inventory management use one scannable list/);
  assert.match(migration,/inventory_product_settings/);
});

test("スマレジ型の商品マスタ一覧で700件超をページ分割して扱える",async()=>{
  const [panel,page,route,migration]=await Promise.all([
    readFile(new URL("app/menu-admin/ProductMasterWorkspace.tsx",root),"utf8"),
    readFile(new URL("app/menu-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/inventory/master/route.ts",root),"utf8"),
    readFile(new URL("drizzle/0025_inventory_master_fields.sql",root),"utf8"),
  ]);
  assert.match(panel,/pageSize=50/);
  assert.match(panel,/スマレジから全件更新/);
  assert.match(panel,/非表示・サービス商品/);
  assert.match(page,/ProductMasterWorkspace/);
  assert.match(route,/LIMIT 10000/);
  assert.match(migration,/category_id/);
});

test("商品マスタ管理は既存GAS経由でスマレジの商品書き込みAPIへ接続する",async()=>{
  const route=await readFile(new URL("app/api/v1/admin/product-master/route.ts",root),"utf8");
  assert.match(route,/SMAREGI_SPEND_RECALC_URL/);
  assert.match(route,/SMAREGI_SPEND_SYNC_KEY/);
  assert.match(route,/apiToken:connection\.token/);
  assert.match(route,/product\.create/);
  assert.match(route,/product\.update/);
  assert.match(route,/product\.status/);
});

test("商品マスタ同期は在庫権限エラーと分離し0件成功を表示しない",async()=>{
  const [route,panel]=await Promise.all([
    readFile(new URL("app/api/v1/admin/inventory/route.ts",root),"utf8"),
    readFile(new URL("app/menu-admin/MasterCatalogPanel.tsx",root),"utf8"),
  ]);
  assert.match(route,/SMAREGI_MASTER_SYNC_FAILED/);
  assert.match(panel,/スマレジAPIから商品を取得できませんでした/);
  assert.match(panel,/商品は0件でした/);
});

test("商品マスタ一覧から商品を選択して確認後にスマレジへ反映できる",async()=>{
  const [panel,route]=await Promise.all([
    readFile(new URL("app/menu-admin/MasterCatalogPanel.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/product-master/route.ts",root),"utf8"),
  ]);
  assert.match(panel,/商品を選択すると、商品情報・画像・期間売価を編集できます/);
  assert.match(panel,/商品を編集/);
  assert.match(panel,/変更内容を確認/);
  assert.match(panel,/この内容で更新する/);
  assert.match(panel,/method:"PUT"/);
  assert.match(route,/typeof body\.pointEligible==="boolean"\?body\.pointEligible:null/);
});

test("商品マスタで画像・期間売価・スマレジ部門名を共通管理する",async()=>{
  const [panel,catalog,imageUpload,imageDelivery,inventoryMaster,orderCatalog,migration,hosting]=await Promise.all([
    readFile(new URL("app/menu-admin/MasterCatalogPanel.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/catalog/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/catalog/image/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/catalog/images/[...key]/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/inventory/master/route.ts",root),"utf8"),
    readFile(new URL("lib/order-catalog.ts",root),"utf8"),
    readFile(new URL("drizzle/0027_product_media_limited_price.sql",root),"utf8"),
    readFile(new URL(".openai/hosting.json",root),"utf8"),
  ]);
  assert.match(panel,/画像を選択/);
  assert.match(panel,/image\/jpeg,image\/png,image\/webp/);
  assert.match(panel,/画像は5MB以下/);
  assert.match(panel,/期間売価（税抜）/);
  assert.match(panel,/categoryName/);
  assert.match(catalog,/limitedPriceStartsAt/);
  assert.match(imageUpload,/PRODUCT_IMAGES/);
  assert.match(imageUpload,/5 \* 1024 \* 1024/);
  assert.match(imageDelivery,/object\.writeHttpMetadata/);
  assert.match(hosting,/"r2": "PRODUCT_IMAGES"/);
  assert.match(inventoryMaster,/category_name AS categoryName/);
  assert.match(orderCatalog,/limitedPriceActive/);
  assert.match(orderCatalog,/taxIncluded\(limitedPrice/);
  assert.match(migration,/limited_price/);
});

test("統合会員管理から商品マスタを部門絞り込み・並び替え付きで扱う",async()=>{
  const [page,sidebar,panel]=await Promise.all([
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/AdminSidebar.tsx",root),"utf8"),
    readFile(new URL("app/menu-admin/ProductMasterWorkspace.tsx",root),"utf8"),
  ]);
  assert.match(sidebar,/key:"products",label:"商品マスタ"/);
  assert.match(page,/tab==="products"/);
  assert.match(page,/<ProductMasterWorkspace allowCreate\/>/);
  assert.match(panel,/部門で絞り込み/);
  assert.match(panel,/すべての部門/);
  assert.match(panel,/商品の並び順/);
  assert.match(panel,/売価が高い順/);
  assert.match(panel,/スマレジ更新が新しい順/);
});

test("新規商品画像とおもひで商店専用レイアウトを管理する",async()=>{
  const [registration,layout,catalog,master,schema]=await Promise.all([
    readFile(new URL("app/menu-admin/ProductMasterRegistration.tsx",root),"utf8"),
    readFile(new URL("app/menu-admin/OmohideLayoutManager.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/catalog/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/inventory/master/route.ts",root),"utf8"),
    readFile(new URL("db/schema.ts",root),"utf8"),
  ]);
  assert.match(registration,/商品画像/);assert.match(registration,/image\/jpeg/);assert.match(registration,/バーコードのない商品/);
  assert.match(layout,/おもひで商店 レイアウト管理/);assert.match(layout,/draggable/);assert.match(layout,/omohideOrder/);
  assert.match(catalog,/omohideDisplay/);assert.match(catalog,/omohideSequence/);assert.match(master,/omohideDisplay/);assert.match(schema,/omohide_display/);
});

test("スタッフサイトでSNS投稿をAIと相談し承認前の台帳へ保存する",async()=>{
  const [page,panel,route,sidebar]=await Promise.all([
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/SnsAssistantPanel.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/sns-assistant/route.ts",root),"utf8"),
    readFile(new URL("app/member-admin/AdminSidebar.tsx",root),"utf8"),
  ]);
  assert.match(page,/SnsAssistantPanel/);
  assert.match(sidebar,/label:"SNSコントロール"/);
  assert.match(panel,/投稿相談AI/);
  assert.match(panel,/投稿台帳/);
  assert.match(panel,/content_json/);
  assert.match(panel,/resource=campaigns/);
  assert.match(panel,/daily:true/);
  assert.match(panel,/この案を投稿台帳へ保存/);
  assert.match(panel,/resource:"campaigns"/);
  assert.match(route,/https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(route,/OPENAI_API_KEY/);
  assert.match(route,/store:false/);
  assert.match(route,/AI毎日投稿案/);
  assert.match(route,/requireAdminSession/);
});

test("スタッフを期限付きメール招待し個別アカウントと権限を管理する",async()=>{
  const [panel,invite,staffApi,acceptApi,session,schema,migration,sidebar,page]=await Promise.all([
    readFile(new URL("app/member-admin/StaffAccountsPanel.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/invite/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/admin/staff/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/admin/staff/accept/route.ts",root),"utf8"),
    readFile(new URL("lib/admin-session.ts",root),"utf8"),
    readFile(new URL("db/schema.ts",root),"utf8"),
    readFile(new URL("drizzle/0031_staff_accounts.sql",root),"utf8"),
    readFile(new URL("app/member-admin/AdminSidebar.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/page.tsx",root),"utf8"),
  ]);
  assert.match(panel,/スタッフ・権限管理/);assert.match(panel,/招待メールを作成/);assert.match(panel,/最終ログイン/);
  assert.match(invite,/スタッフアカウント登録/);assert.match(invite,/10文字以上/);
  assert.match(staffApi,/72\*3600000/);assert.match(staffApi,/SHA-256/);assert.match(staffApi,/STAFF_INVITED/);
  assert.match(acceptApi,/createAdminPasswordRecord/);assert.match(acceptApi,/STAFF_INVITE_ACCEPTED/);
  assert.match(session,/staff_accounts/);assert.match(session,/status='ACTIVE'/);
  assert.match(schema,/staffAccounts/);assert.match(migration,/staff_accounts/);
  assert.match(sidebar,/スタッフ・権限/);assert.match(page,/StaffAccountsPanel/);
});

test("スタッフサイトの全ボタンは押下と受付完了を視覚表示する",async()=>{
  const [feedback,sidebar,styles]=await Promise.all([
    readFile(new URL("app/member-admin/ButtonFeedback.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/AdminSidebar.tsx",root),"utf8"),
    readFile(new URL("app/member-admin/member-admin.css",root),"utf8"),
  ]);
  assert.match(feedback,/\.member-admin-page button/);assert.match(feedback,/staff-button-accepted/);assert.match(feedback,/addEventListener\("click"/);
  assert.match(sidebar,/ButtonFeedback/);assert.match(styles,/button:not\(:disabled\):active/);assert.match(styles,/focus-visible/);assert.match(styles,/prefers-reduced-motion/);
});

test("テスト注文は本番の呼出番号を消費せず受渡後に完了する",async()=>{
  const route=await readFile(new URL("app/api/v1/kitchen/units/route.ts",root),"utf8");
  assert.match(route,/item\.isTest\?`TEST:\$\{date\}`:date/);
  assert.match(route,/if\(values\.length===0\).*SELECT status FROM kitchen_units/s);
});

test("LIFFは登録済みの正式ドメインへ移動してからログインする",async()=>{
  const [page,route]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/client-config/route.ts",root),"utf8"),
  ]);
  assert.match(route,/canonicalBaseUrl/);
  assert.match(route,/https:\/\/members\.wce-group-japan\.com/);
  assert.match(page,/window\.location\.origin!==canonical\.origin/);
  assert.match(page,/window\.location\.replace/);
});

test("商品マスターURL未設定時も許可された画面はスナップショットへ退避する",async()=>{
  const catalog=await readFile(new URL("lib/order-catalog.ts",root),"utf8");
  assert.doesNotMatch(catalog,/if\(!url\)throw new Error\("CATALOG_URL_NOT_CONFIGURED"\);\s*let body/);
  assert.match(catalog,/try\{if\(!url\)throw new Error\("CATALOG_URL_NOT_CONFIGURED"\)/);
  assert.match(catalog,/if\(!options\.allowSnapshotFallback\)throw error/);
});

test("共通会員認証は会員DBだけを参照し用途別トークン・監査・冪等性を備える", async () => {
  const [route, auth, schema, migration, docs] = await Promise.all([
    readFile(new URL("app/api/v1/member-verification/route.ts", root), "utf8"),
    readFile(new URL("lib/member-verification.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0030_member_verification.sql", root), "utf8"),
    readFile(new URL("docs/MEMBER_VERIFICATION_API.md", root), "utf8"),
  ]);
  assert.match(route, /FROM members WHERE member_code=\?/);
  assert.doesNotMatch(route, /fetch\(|スマレジ|GAS|reservation/i);
  assert.match(route, /UNREGISTERED/);
  assert.match(route, /SUSPENDED/);
  assert.match(route, /WITHDRAWN/);
  assert.match(route, /REQUEST_ID_CONFLICT/);
  assert.match(route, /memberCodeHash=await sha256\(memberCode\)/);
  assert.match(route, /X-Idempotent-Replay/);
  assert.match(auth, /MEMBER_VERIFICATION_SELF_REGISTER_TOKEN/);
  assert.match(auth, /difference\|=/);
  assert.match(schema, /memberVerificationAudits/);
  assert.match(migration, /verification_status`='SUSPENDED'/);
  assert.match(docs, /503 `VERIFICATION_SERVICE_UNAVAILABLE`/);
});
