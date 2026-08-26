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

test("スマート決済後は通常ブラウザではなくLIFFの注文画面へ戻す",async()=>{
  const route=await readFile(new URL("app/api/v1/orders/[id]/smart-payment/route.ts",root),"utf8");
  assert.match(route,/https:\/\/liff\.line\.me\//);
  assert.match(route,/success_url:\`\$\{base\}\/mobile-order\?payment=success/);
  assert.match(route,/cancel_url:\`\$\{base\}\/mobile-order\?payment=cancelled/);
});
