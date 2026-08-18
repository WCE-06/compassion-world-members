"use client";

import { ArrowLeft, CheckCircle2, PackageSearch, Send } from "lucide-react";
import { FormEvent, useState } from "react";

type RequestKind = "ORDER" | "STOCK" | "IDEA";

export default function ProductRequestPage() {
  const [kind, setKind] = useState<RequestKind>("ORDER");
  const [productName, setProductName] = useState("");
  const [details, setDetails] = useState("");
  const [quantity, setQuantity] = useState("");
  const [contactAllowed, setContactAllowed] = useState(true);
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productName.trim()) return setMessage("商品名を入力してください");
    setSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/product-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, productName: productName.trim(), details: details.trim(), quantity: quantity.trim(), contactAllowed }),
      });
      const result = await response.json() as { saved?: boolean; message?: string };
      if (!response.ok) throw new Error(result.message || "送信できませんでした");
      setCompleted(true);
      if (!result.saved) setMessage("現在は開発用受付です。共通台帳との接続後に正式受付を開始します。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "送信できませんでした");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="request-shell">
      <header className="request-head"><button onClick={() => history.back()} aria-label="戻る"><ArrowLeft size={20} /></button><div><small>OMOHIDE SHOTEN</small><h1>商品リクエスト</h1></div></header>
      {!completed ? (
        <>
          <section className="request-intro"><span><PackageSearch size={25} strokeWidth={1.5} /></span><div><p>おもひで商店を一緒につくる</p><h2>何をお探しですか？</h2><small>取り寄せたい商品や、店頭に置いてほしい商品をお聞かせください。1点からでもお気軽にどうぞ。</small></div></section>
          <form className="product-request-form" onSubmit={submit}>
            <fieldset><legend>ご希望の内容</legend><div className="request-kind">
              <button type="button" className={kind === "ORDER" ? "selected" : ""} onClick={() => setKind("ORDER")}><strong>取り寄せ希望</strong><small>購入を検討している</small></button>
              <button type="button" className={kind === "STOCK" ? "selected" : ""} onClick={() => setKind("STOCK")}><strong>置いてほしい</strong><small>店頭にあると嬉しい</small></button>
              <button type="button" className={kind === "IDEA" ? "selected" : ""} onClick={() => setKind("IDEA")}><strong>商品アイデア</strong><small>こんな商品が欲しい</small></button>
            </div></fieldset>
            <label>商品名・ブランド名 <b>必須</b><input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="例：〇〇県のご当地ジュース" maxLength={100} /></label>
            <label>希望数量 <span>任意</span><input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="例：2本、1ケース、月10個程度" maxLength={50} /></label>
            <label>詳しい内容 <span>任意</span><textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="メーカー、サイズ、予算、用途、購入したい時期など" maxLength={1000} rows={5} /></label>
            <label className="contact-check"><input type="checkbox" checked={contactAllowed} onChange={(e) => setContactAllowed(e.target.checked)} /><span>入荷・取り寄せ可否について連絡を受け取る</span></label>
            {message && <p className="form-message">{message}</p>}
            <button className="request-submit" disabled={sending || !productName.trim()}><Send size={17} />{sending ? "送信しています" : "リクエストを送る"}</button>
            <p className="request-note">リクエストは在庫確保や購入を保証するものではありません。内容を確認後、ご希望に添える場合にご案内します。</p>
          </form>
        </>
      ) : (
        <section className="request-complete"><CheckCircle2 size={48} strokeWidth={1.4} /><p>THANK YOU</p><h2>リクエストを<br />ありがとうございます</h2><span>いただいたご意見は、おもひで商店の商品選びや外商のご提案に活用します。</span>{message && <small>{message}</small>}<a href="/">ポイントカードへ戻る</a></section>
      )}
    </main>
  );
}
