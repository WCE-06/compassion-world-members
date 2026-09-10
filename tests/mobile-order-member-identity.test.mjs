import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);

test("モバイルオーダーはプレビュー会員を送らずLINEアクセストークンを使う",async()=>{
  const page=await readFile(new URL("app/mobile-order/page.tsx",root),"utf8");
  assert.doesNotMatch(page,/X-Compass-Preview/);
  assert.match(page,/getAccessToken/);
  assert.match(page,/Authorization:\s*`Bearer \$\{token\}`/);
});

test("注文・見積・スマート決済APIは本番会員認証のみを許可する",async()=>{
  const files=await Promise.all([
    readFile(new URL("app/api/v1/orders/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/orders/estimate/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/orders/[id]/smart-payment/route.ts",root),"utf8"),
  ]);
  for(const source of files){
    assert.match(source,/authenticatedLiveMember/);
    assert.doesNotMatch(source,/X-Compass-Preview|x-compass-preview/);
  }
});

test("会員証はサーバー確定済みの本人番号だけを2次元コードへ使用する",async()=>{
  const [page,card,membership]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/api/v1/me/card/route.ts",root),"utf8"),
    readFile(new URL("app/api/v1/me/membership/route.ts",root),"utf8"),
  ]);
  assert.match(card,/qrValue:row\.memberCode/);
  assert.match(membership,/qrValue:member\.memberCode/);
  assert.match(page,/next\.memberCode!==next\.qrValue/);
  assert.match(page,/current\.memberId!==next\.memberId/);
  assert.match(page,/<MemberQr value=\{member\.qrValue\}/);
});

test("スマート決済後は通常ブラウザではなくLIFFの注文画面へ戻す",async()=>{
  const route=await readFile(new URL("app/api/v1/orders/[id]/smart-payment/route.ts",root),"utf8");
  assert.match(route,/https:\/\/liff\.line\.me\//);
  assert.match(route,/success_url:\`\$\{base\}\/mobile-order\?payment=success/);
  assert.match(route,/cancel_url:\`\$\{base\}\/mobile-order\?payment=cancelled/);
});
