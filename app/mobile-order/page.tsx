"use client";

import { ArrowLeft, Coffee, CreditCard, ShoppingBasket, Store, UtensilsCrossed } from "lucide-react";

export default function MobileOrderPage() {
  return (
    <main className="order-shell">
      <header className="order-head"><button onClick={() => history.back()} aria-label="戻る"><ArrowLeft size={20} /></button><div><small>COMPASSION WORLD</small><h1>Aozora Kitchen</h1></div><span>モバイルオーダー</span></header>
      <section className="order-hero"><p>ORDER & PICK UP</p><h2>お好きな商品を選んで<br />スムーズに受け取り</h2><span>ポイントカードの会員情報を引き継ぐため、氏名や電話番号の再入力は不要です。</span></section>
      <section className="order-categories"><button onClick={() => alert("フードメニューは共通商品APIとの接続後に表示します")}><span><UtensilsCrossed size={26} strokeWidth={1.5} /></span><strong>フード</strong><small>食事・軽食を見る</small><b>›</b></button><button onClick={() => alert("ドリンクメニューは共通商品APIとの接続後に表示します")}><span><Coffee size={26} strokeWidth={1.5} /></span><strong>ドリンク</strong><small>飲み物を見る</small><b>›</b></button></section>
      <section className="order-guide"><p>お支払い方法</p><div><span><CreditCard size={20} /></span><strong>事前クレジット決済</strong><small>商品を選んだ後、そのままお支払い</small></div><div><span><Store size={20} /></span><strong>セルフレジでお支払い</strong><small>注文番号または会員QRを店頭で提示</small></div></section>
      <section className="order-empty"><ShoppingBasket size={34} strokeWidth={1.3} /><h3>商品メニュー接続準備中</h3><p>共通メニュー・キッチンシステムとの接続後、ここに販売中の商品、受取可能時刻、売り切れ情報を表示します。</p></section>
    </main>
  );
}
