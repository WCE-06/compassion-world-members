"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Coffee, History, House, IdCard, MessageSquarePlus, TicketPercent, UtensilsCrossed } from "lucide-react";

type View = "loading" | "member" | "unlinked" | "new" | "error";

type MemberNotice = {
  id: string;
  category: "PAYMENT" | "POINT" | "RESERVATION" | "ORDER" | "NEWS";
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
};

type Member = {
  memberId: string;
  memberCode: string;
  displayName: string;
  points: number;
  rank: string;
  nextReservation?: { facilityName: string; startsAt: string; endsAt: string } | null;
  session?: {
    facilityName: string;
    status: "RESERVED" | "IN_USE" | "EXTENDING" | "COMPLETED";
    paymentStatus: "UNCONFIRMED" | "UNPAID" | "PROCESSING" | "PAID" | "FAILED";
    startedAt?: string;
    scheduledEndsAt?: string;
    unpaidAmount?: number;
  } | null;
  activeOrder?: { orderNumber: string; foodCallNumber?:number|null; drinkCallNumber?:number|null; status: "WAITING_PAYMENT" | "ACCEPTED" | "COOKING" | "READY" } | null;
  notices: MemberNotice[];
};

declare global {
  interface Window {
    liff?: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: (config?: { redirectUri?: string }) => void;
      getAccessToken: () => string | null;
    };
  }
}

const DEMO_MEMBER: Member = {
  memberId: "mem_01JCOMPASSION",
  memberCode: "A7K4P9X2M6",
  displayName: "山田 花子",
  points: 480,
  rank: "STANDARD",
  nextReservation: {
    facilityName: "Music Studio FEBBRAIO",
    startsAt: "2026-08-22T14:00:00+09:00",
    endsAt: "2026-08-22T16:00:00+09:00",
  },
  session: null,
  activeOrder: null,
  notices: [
    { id: "n1", category: "POINT", title: "120ポイント付与されました", body: "おもひで商店のご利用ありがとうございました。", createdAt: "今日 12:42", unread: true },
    { id: "n2", category: "PAYMENT", title: "お支払いが完了しました", body: "ご利用明細を確認できます。", createdAt: "今日 12:41", unread: true },
    { id: "n3", category: "NEWS", title: "今週のお知らせ", body: "COMPASSION WORLDからのお知らせです。", createdAt: "8月17日", unread: false },
  ],
};

function normalizeMemberCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function loadScript(src: string, ready: () => boolean) {
  return new Promise<void>((resolve, reject) => {
    if (ready()) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("必要な機能を読み込めませんでした")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("必要な機能を読み込めませんでした"));
    document.head.appendChild(script);
  });
}

function MemberQr({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(async () => {
        if (!active || !canvasRef.current) return;
        await QRCode.toCanvas(canvasRef.current, value, {
          width: 196,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#142d26", light: "#ffffff" },
        });
      })
      .catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [value]);

  return (
    <div className="qr-panel" aria-label={`会員番号 ${value} のQRコード`}>
      {failed ? <div className="qr-fallback">QR<br />読み込み中</div> : <canvas ref={canvasRef} width="196" height="196" />}
      <div><small>MEMBER No.</small><strong>{value}</strong></div>
    </div>
  );
}

function dateLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function paymentLabel(status: NonNullable<Member["session"]>["paymentStatus"]) {
  return { UNCONFIRMED: "料金未確定", UNPAID: "未精算", PROCESSING: "決済処理中", PAID: "精算済み", FAILED: "決済を確認してください" }[status];
}

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [member, setMember] = useState<Member>(DEMO_MEMBER);
  const [notice, setNotice] = useState("");
  const [demo, setDemo] = useState(false);
  const [memberCode, setMemberCode] = useState("");
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [lineToken,setLineToken]=useState("");
  const [registering,setRegistering]=useState(false);
  const [registration,setRegistration]=useState({displayName:"",phone:"",birthDate:"",postalCode:"",address:"",email:"",acceptedTerms:false});

  useEffect(() => {
    async function start() {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("state");
      const liffId = await fetch("/api/v1/client-config").then(response=>response.ok?response.json():{liffId:""}).then(config=>String(config.liffId??"")).catch(()=>"");

      if (!liffId) {
        setDemo(true);
        if (requested === "unlinked") return setView("unlinked");
        if (requested === "new") return setView("new");
        const response = await fetch("/api/v1/me/membership", { headers: { "X-Compass-Preview": "representative" } });
        if (response.ok) setMember(await response.json());
        setView("member");
        return;
      }

      try {
        await loadScript("https://static.line-scdn.net/liff/edge/2/sdk.js", () => Boolean(window.liff));
        await window.liff!.init({ liffId });
        if (!window.liff!.isLoggedIn()) {
          window.liff!.login({ redirectUri: window.location.href });
          return;
        }
        const token = window.liff!.getAccessToken();
        setLineToken(token??"");
        const response = await fetch("/api/v1/me/membership", { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 404) return setView("unlinked");
        if (response.status === 422) return setView("new");
        if (!response.ok) throw new Error("会員情報を取得できませんでした");
        setMember(await response.json());
        setView("member");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "読み込みに失敗しました");
        setView("error");
      }
    }
    start();
  }, []);

  const unreadCount = member.notices.filter((item) => item.unread).length;
  const visibleNotices = showAllNotices ? member.notices : member.notices.slice(0, 2);
  const openFutureFeature = (label: string) => setNotice(`${label}は共通システムとの接続準備中です`);
  const register=async()=>{if(registering)return;setRegistering(true);setNotice("");try{if(demo){setMember(DEMO_MEMBER);setView("member");setNotice("開発用の新規登録が完了しました");return}const response=await fetch("/api/v1/members",{method:"POST",headers:{Authorization:`Bearer ${lineToken}`,"Content-Type":"application/json"},body:JSON.stringify(registration)});if(!response.ok)throw new Error("登録内容を確認してください");const membership=await fetch("/api/v1/me/membership",{headers:{Authorization:`Bearer ${lineToken}`}});if(!membership.ok)throw new Error("会員証を取得できませんでした");setMember(await membership.json());setView("member");setNotice("新しいポイントカードを発行しました")}catch(error){setNotice(error instanceof Error?error.message:"登録できませんでした")}finally{setRegistering(false)}};

  return (
    <main className="app-shell">
      <header className="brand-header">
        <div className="brand-mark" aria-hidden="true"><span>C</span><span>W</span></div>
        <div><p className="eyebrow">COMPASSION WORLD</p><h1>POINT CARD</h1></div>
        <button className="notice-button" aria-label={`お知らせ 未読${unreadCount}件`} onClick={() => document.getElementById("notices")?.scrollIntoView({ behavior: "smooth" })}>
          <Bell aria-hidden="true" size={17} strokeWidth={1.7} />{unreadCount > 0 && <b>{unreadCount}</b>}
        </button>
      </header>

      {demo && <div className="demo-strip"><span>DEMO</span> 開発用URLで表示しています</div>}
      {view === "loading" && <section className="loading-state"><div className="loader" /><p>ポイントカードを準備しています</p></section>}

      {view === "member" && (
        <>
          <section className="wallet-card">
            <div className="wallet-card-head"><div><span>会員証</span><strong>{member.displayName} 様</strong></div><button onClick={() => setNotice("会員番号を受付端末へ提示してください")}>拡大</button></div>
            <MemberQr value={member.memberCode} />
            <div className="wallet-balances">
              <button onClick={() => openFutureFeature("ポイント履歴")}><small>保有ポイント</small><strong>{member.points.toLocaleString("ja-JP")}<span> P</span></strong><em>履歴を見る ›</em></button>
              <button onClick={() => openFutureFeature("会員特典")}><small>会員ランク</small><strong className="rank-value">{member.rank}</strong><em>特典を見る ›</em></button>
            </div>
          </section>

          <section className="majica-actions" aria-label="よく使うサービス">
            <button onClick={() => { window.location.href = "/availability"; }}><span><CalendarDays aria-hidden="true" size={19} strokeWidth={1.7} /></span><strong>予約</strong></button>
            <button onClick={() => { window.location.href = "/mobile-order"; }}><span className="food-drink-icon"><UtensilsCrossed aria-hidden="true" size={17} strokeWidth={1.7} /><Coffee aria-hidden="true" size={15} strokeWidth={1.7} /></span><strong>フード・ドリンク</strong><small>Aozora Kitchen</small></button>
            <button onClick={() => openFutureFeature("クーポン")}><span><TicketPercent aria-hidden="true" size={20} strokeWidth={1.7} /></span><strong>クーポン</strong></button>
            <button onClick={() => openFutureFeature("利用履歴")}><span><History aria-hidden="true" size={20} strokeWidth={1.7} /></span><strong>履歴</strong></button>
          </section>

          <button className="service-banner" onClick={() => openFutureFeature("おもひで商店のご案内")}><span>OMOHIDE SHOTEN</span><strong>おもひで商店を、もっと便利に。</strong><small>会員限定のお知らせ・特典を見る　›</small></button>

          <button className="request-banner" onClick={() => { window.location.href = "/product-request"; }}>
            <span><MessageSquarePlus aria-hidden="true" size={22} strokeWidth={1.6} /></span>
            <div><small>OMOHIDE SHOTEN REQUEST</small><strong>取り寄せ希望・置いてほしい商品</strong><p>「こんな商品があったらいいな」をお聞かせください</p></div><b>›</b>
          </button>

          {(member.session || member.nextReservation || member.activeOrder) && (
            <section className="activity-card">
              <div className="section-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>予約・Aozora Kitchen注文</h2></div><button onClick={() => openFutureFeature("利用履歴")}>履歴を見る</button></div>
              <div className="activity-create-actions">
                <button onClick={() => { window.location.href = "/availability"; }}><CalendarDays size={17} strokeWidth={1.7} /><span><small>STUDIO</small><strong>新しく予約する</strong></span><b>›</b></button>
                <button onClick={() => { window.location.href = "/mobile-order"; }}><UtensilsCrossed size={17} strokeWidth={1.7} /><span><small>AOZORA KITCHEN</small><strong>商品を注文する</strong></span><b>›</b></button>
              </div>
              {member.session && (
                <article className="activity-row active-session"><span className="status-dot" /><div><small>現在利用中</small><strong>{member.session.facilityName}</strong><p>{member.session.startedAt && `開始 ${dateLabel(member.session.startedAt)}`} {member.session.scheduledEndsAt && `／終了予定 ${dateLabel(member.session.scheduledEndsAt)}`}</p></div><b>{paymentLabel(member.session.paymentStatus)}</b></article>
              )}
              {!member.session && member.nextReservation && (
                <article className="activity-row"><span className="date-chip">NEXT</span><div><small>次回予約</small><strong>{member.nextReservation.facilityName}</strong><p>{dateLabel(member.nextReservation.startsAt)}〜</p></div><button onClick={() => openFutureFeature("予約の変更・キャンセル")}>詳細</button></article>
              )}
              {member.activeOrder && (
                <article className="activity-row"><span className="date-chip">ORDER</span><div><small>{[member.activeOrder.foodCallNumber&&`フード ${String(member.activeOrder.foodCallNumber).padStart(3,"0")}`,member.activeOrder.drinkCallNumber&&`ドリンク ${String(member.activeOrder.drinkCallNumber).padStart(3,"0")}`].filter(Boolean).join(" ／ ")||"注文受付済み"}</small><strong>{{ WAITING_PAYMENT: "お支払い待ち", ACCEPTED: "注文受付済み", COOKING: "ただいま調理中", READY: "商品ができあがりました" }[member.activeOrder.status]}</strong></div><button onClick={() => openFutureFeature("注文状況")}>詳細</button></article>
              )}
            </section>
          )}

          <section className="benefit-grid">
            <button onClick={() => openFutureFeature("クーポン")}><span>COUPON</span><strong>クーポン</strong><small>保有特典を確認</small></button>
            <button onClick={() => openFutureFeature("会員特典")}><span>MEMBER</span><strong>{member.rank}</strong><small>会員限定価格・特典</small></button>
          </section>

          <section className="notice-list" id="notices">
            <div className="section-heading"><div><p className="eyebrow">INFORMATION</p><h2>お知らせ</h2></div>{unreadCount > 0 && <span className="unread-label">未読 {unreadCount}</span>}</div>
            {visibleNotices.map((item) => (
              <button className="notice-row" key={item.id} onClick={() => setNotice(item.body)}>
                <span className={`notice-category ${item.category.toLowerCase()}`}>{item.category === "PAYMENT" ? "決済" : item.category === "POINT" ? "ポイント" : item.category === "ORDER" ? "注文" : item.category === "RESERVATION" ? "予約" : "お知らせ"}</span>
                <div><strong>{item.title}</strong><small>{item.createdAt}</small></div>{item.unread && <i aria-label="未読" />}<b>›</b>
              </button>
            ))}
            {member.notices.length > 2 && <button className="all-notices" onClick={() => setShowAllNotices((value) => !value)}>{showAllNotices ? "閉じる" : "すべてのお知らせを見る"}</button>}
          </section>

          <nav className="bottom-tabs" aria-label="メインメニュー">
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><span><House aria-hidden="true" size={17} strokeWidth={1.7} /></span><strong>ホーム</strong></button>
            <button onClick={() => openFutureFeature("クーポン")}><span><TicketPercent aria-hidden="true" size={18} strokeWidth={1.7} /></span><strong>クーポン</strong></button>
            <button className="card-tab" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><span><IdCard aria-hidden="true" size={23} strokeWidth={1.6} /></span><strong>会員証</strong></button>
            <button onClick={() => { window.location.href = "/availability"; }}><span><CalendarDays aria-hidden="true" size={18} strokeWidth={1.7} /></span><strong>予約</strong></button>
            <button onClick={() => document.getElementById("notices")?.scrollIntoView({ behavior: "smooth" })}><span><Bell aria-hidden="true" size={17} strokeWidth={1.7} /></span><strong>お知らせ</strong>{unreadCount > 0 && <i>{unreadCount}</i>}</button>
          </nav>
        </>
      )}

      {view === "unlinked" && (
        <section className="flow-card">
          <div className="flow-icon">↗</div><p className="eyebrow">MEMBER TRANSFER</p><h2>これまでのポイントを<br />引き継ぎましょう</h2>
          <p>LINEに登録済みの会員情報を、新しいポイントカードへ紐付けます。</p>
          <label>10文字の会員番号<input value={memberCode} onChange={(event) => setMemberCode(normalizeMemberCode(event.target.value))} inputMode="text" autoCapitalize="characters" placeholder="例）A7K4P9X2M6" maxLength={10} /></label>
          <button className="flow-button" disabled={memberCode.length !== 10} onClick={() => { setMember({ ...DEMO_MEMBER, memberCode }); setView("member"); setNotice("会員情報を引き継ぎました"); }}>会員情報を引き継ぐ</button>
          <button className="text-button" onClick={() => setNotice("スタッフ確認用の案内を表示します")}>会員番号が分からない方</button>
          <button className="text-button secondary" onClick={() => setView("new")}>初めてご利用の方</button>
        </section>
      )}

      {view === "new" && (
        <section className="flow-card">
          <div className="flow-icon">＋</div><p className="eyebrow">NEW MEMBER</p><h2>COMPASSION WORLDを<br />もっと身近に</h2>
          <p>ポイントカードを作ると、おもひで商店への入店、ポイント、予約、モバイルオーダーをご利用いただけます。</p>
          <ul className="registration-list"><li>SMS認証は現在使用しません</li><li>登録後すぐに会員QRを表示</li><li>空欄の既存LINE会員もこちらから登録</li></ul>
          <div className="registration-form"><label>氏名（必須）<input autoComplete="name" value={registration.displayName} onChange={event=>setRegistration({...registration,displayName:event.target.value})}/></label><label>電話番号（必須）<input inputMode="tel" autoComplete="tel" value={registration.phone} onChange={event=>setRegistration({...registration,phone:event.target.value})}/></label><label>生年月日（必須）<input type="date" value={registration.birthDate} onChange={event=>setRegistration({...registration,birthDate:event.target.value})}/></label><label>郵便番号（必須）<input inputMode="numeric" autoComplete="postal-code" value={registration.postalCode} onChange={event=>setRegistration({...registration,postalCode:event.target.value})}/></label><label>住所（必須）<input autoComplete="street-address" value={registration.address} onChange={event=>setRegistration({...registration,address:event.target.value})}/></label><label>メールアドレス（任意）<input type="email" autoComplete="email" value={registration.email} onChange={event=>setRegistration({...registration,email:event.target.value})}/></label><label className="terms-check"><input type="checkbox" checked={registration.acceptedTerms} onChange={event=>setRegistration({...registration,acceptedTerms:event.target.checked})}/><span>利用規約・プライバシーポリシーに同意します</span></label></div>
          <button className="flow-button" disabled={registering||!registration.displayName||!registration.phone||!registration.birthDate||!registration.postalCode||!registration.address||!registration.acceptedTerms} onClick={register}>{registering?"登録しています…":"新しいポイントカードを作る"}</button>
          <button className="text-button" onClick={() => setView("unlinked")}>以前の会員番号をお持ちの方</button>
        </section>
      )}

      {view === "error" && <section className="flow-card"><div className="flow-icon">!</div><h2>接続を確認してください</h2><p>{notice}</p><button className="flow-button" onClick={() => window.location.reload()}>もう一度読み込む</button></section>}
      {notice && view !== "error" && <div className="toast" role="status" onClick={() => setNotice("")}>{notice}<button aria-label="閉じる">×</button></div>}

      {demo && view !== "loading" && <nav className="demo-nav" aria-label="開発用画面切り替え"><button className={view === "member" ? "active" : ""} onClick={() => setView("member")}>カード</button><button className={view === "unlinked" ? "active" : ""} onClick={() => setView("unlinked")}>移行</button><button className={view === "new" ? "active" : ""} onClick={() => setView("new")}>新規</button></nav>}
      <footer><span>COMPASSION</span><i /><span>CREATIVITY</span><i /><span>COMMUNITY</span></footer>
    </main>
  );
}
