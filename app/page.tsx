"use client";

import { useEffect, useMemo, useState } from "react";

type View = "loading" | "member" | "unlinked" | "new" | "error";

type Member = {
  memberId: string;
  memberCode: string;
  displayName: string;
  session?: {
    status: "RESERVED" | "IN_USE" | "COMPLETED";
    paymentStatus: "UNPAID" | "PAID";
    reservedStart?: string;
    reservedEnd?: string;
  } | null;
};

declare global {
  interface Window {
    liff?: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: (config?: { redirectUri?: string }) => void;
      getAccessToken: () => string | null;
      getProfile: () => Promise<{ userId: string; displayName: string }>;
      isInClient: () => boolean;
      closeWindow: () => void;
    };
  }
}

const DEMO_MEMBER: Member = {
  memberId: "mem_01JCOMPASSION",
  memberCode: "00001234",
  displayName: "山田 花子",
  session: null,
};

const CODE128: Record<string, string> = {
  "0":"212222","1":"222122","2":"222221","3":"121223","4":"121322","5":"131222","6":"122213","7":"122312","8":"132212","9":"221213",
  "10":"221312","11":"231212","12":"112232","13":"122132","14":"122231","15":"113222","16":"123122","17":"123221","18":"223211","19":"221132",
  "20":"221231","21":"213212","22":"223112","23":"312131","24":"311222","25":"321122","26":"321221","27":"312212","28":"322112","29":"322211",
  "30":"212123","31":"212321","32":"232121","33":"111323","34":"131123","35":"131321","36":"112313","37":"132113","38":"132311","39":"211313",
  "40":"231113","41":"231311","42":"112133","43":"112331","44":"132131","45":"113123","46":"113321","47":"133121","48":"313121","49":"211331",
  "50":"231131","51":"213113","52":"213311","53":"213131","54":"311123","55":"311321","56":"331121","57":"312113","58":"312311","59":"332111",
  "60":"314111","61":"221411","62":"431111","63":"111224","64":"111422","65":"121124","66":"121421","67":"141122","68":"141221","69":"112214",
  "70":"112412","71":"122114","72":"122411","73":"142112","74":"142211","75":"241211","76":"221114","77":"413111","78":"241112","79":"134111",
  "80":"111242","81":"121142","82":"121241","83":"114212","84":"124112","85":"124211","86":"411212","87":"421112","88":"421211","89":"212141",
  "90":"214121","91":"412121","92":"111143","93":"111341","94":"131141","95":"114113","96":"114311","97":"411113","98":"411311","99":"113141",
  "100":"114131","101":"311141","102":"411131","103":"211412","104":"211214","105":"211232","106":"2331112"
};

function barcodeBits(value: string) {
  const values = [...value].map((char) => char.charCodeAt(0) - 32);
  const checksum = (104 + values.reduce((sum, n, index) => sum + n * (index + 1), 0)) % 103;
  return [104, ...values, checksum, 106]
    .flatMap((code) => [...CODE128[String(code)]].flatMap((width, index) => Array(Number(width)).fill(index % 2 === 0 ? "1" : "0")))
    .join("");
}

function Barcode({ value }: { value: string }) {
  const bits = useMemo(() => barcodeBits(value), [value]);
  return (
    <div className="barcode-wrap" aria-label={`会員番号 ${value} のバーコード`}>
      <div className="barcode" style={{ gridTemplateColumns: `repeat(${bits.length}, 1fr)` }}>
        {[...bits].map((bit, index) => <i key={index} className={bit === "1" ? "bar" : "space"} />)}
      </div>
      <div className="barcode-number">{value}</div>
    </div>
  );
}

function loadLiffScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.liff) return resolve();
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("LIFF SDKを読み込めませんでした"));
    document.head.appendChild(script);
  });
}

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [member, setMember] = useState<Member>(DEMO_MEMBER);
  const [notice, setNotice] = useState<string>("");
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    async function start() {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("state");
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

      if (!liffId) {
        setDemo(true);
        setView(requested === "unlinked" ? "unlinked" : requested === "new" ? "new" : "member");
        return;
      }

      try {
        await loadLiffScript();
        await window.liff!.init({ liffId });
        if (!window.liff!.isLoggedIn()) {
          window.liff!.login({ redirectUri: window.location.href });
          return;
        }
        const token = window.liff!.getAccessToken();
        const response = await fetch("/api/v1/me/membership", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 404) {
          setView("unlinked");
          return;
        }
        if (response.status === 422) {
          setView("new");
          return;
        }
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

  const openPlaceholder = (label: string) => setNotice(`${label}は次の開発段階で接続します`);

  return (
    <main className="app-shell">
      <header className="brand-header">
        <div className="brand-mark" aria-hidden="true"><span>C</span><span>W</span></div>
        <div>
          <p className="eyebrow">COMPASSION WORLD</p>
          <h1>MEMBERS CARD</h1>
        </div>
        <button className="help-button" aria-label="ヘルプ" onClick={() => setNotice("受付スタッフへこの画面をお見せください")}>?</button>
      </header>

      {demo && <div className="demo-strip"><span>DEMO</span> 開発用プレビュー</div>}

      {view === "loading" && <section className="loading-state"><div className="loader" /><p>会員情報を確認しています</p></section>}

      {view === "member" && (
        <>
          <section className="member-card">
            <div className="card-glow" />
            <div className="card-top"><span>MEMBER</span><span className="valid-dot">● ACTIVE</span></div>
            <div className="member-name"><span>MEMBER NAME</span><strong>{member.displayName || "お名前未登録"}</strong></div>
            <Barcode value={member.memberCode} />
            <div className="member-meta"><span>MEMBER No.</span><strong>{member.memberCode}</strong></div>
          </section>

          {member.session?.status === "IN_USE" && (
            <section className="session-card">
              <span className="pulse" />
              <div><small>STUDIO SESSION</small><strong>現在スタジオをご利用中です</strong></div>
              <b className={member.session.paymentStatus === "PAID" ? "paid" : "unpaid"}>{member.session.paymentStatus === "PAID" ? "精算済" : "未精算"}</b>
            </section>
          )}

          <section className="actions" aria-label="会員メニュー">
            <button className="action primary" onClick={() => openPlaceholder("スタジオ予約")}>
              <span className="action-icon calendar" aria-hidden="true">□</span><span><small>STUDIO</small><strong>スタジオを予約する</strong></span><b>›</b>
            </button>
            <button className="action" onClick={() => openPlaceholder("モバイルオーダー")}>
              <span className="action-icon bag" aria-hidden="true">♢</span><span><small>AOZORA KITCHEN</small><strong>モバイルオーダー</strong></span><b>›</b>
            </button>
          </section>
        </>
      )}

      {view === "unlinked" && (
        <section className="flow-card">
          <div className="flow-icon">↗</div><p className="eyebrow">MEMBER TRANSFER</p>
          <h2>以前の会員番号を<br />引き継ぎましょう</h2>
          <p>お持ちの会員番号を、このLINEアカウントに紐付けます。会員番号が分からない場合も確認できます。</p>
          <label>既存の会員番号<input inputMode="numeric" placeholder="例）00001234" maxLength={12} /></label>
          <button className="flow-button" onClick={() => { setMember(DEMO_MEMBER); setView("member"); setNotice("会員番号を紐付けました"); }}>会員番号を引き継ぐ</button>
          <button className="text-button" onClick={() => setNotice("受付スタッフが会員情報を確認します")}>会員番号が分からない方</button>
        </section>
      )}

      {view === "new" && (
        <section className="flow-card">
          <div className="flow-icon">＋</div><p className="eyebrow">NEW MEMBER</p>
          <h2>COMPASSION WORLDへ<br />ようこそ</h2>
          <p>会員登録をすると、デジタル会員証・スタジオ予約・モバイルオーダーをご利用いただけます。</p>
          <button className="flow-button" onClick={() => setNotice("会員登録フォームは次の開発段階で接続します")}>新規会員登録へ</button>
          <button className="text-button" onClick={() => setView("unlinked")}>以前の会員番号をお持ちの方</button>
        </section>
      )}

      {view === "error" && (
        <section className="flow-card"><div className="flow-icon">!</div><h2>接続を確認してください</h2><p>{notice}</p><button className="flow-button" onClick={() => window.location.reload()}>もう一度読み込む</button></section>
      )}

      {notice && view !== "error" && <div className="toast" role="status" onClick={() => setNotice("")}>{notice}<button aria-label="閉じる">×</button></div>}

      {demo && view !== "loading" && (
        <nav className="demo-nav" aria-label="開発用画面切り替え">
          <button className={view === "member" ? "active" : ""} onClick={() => setView("member")}>会員証</button>
          <button className={view === "unlinked" ? "active" : ""} onClick={() => setView("unlinked")}>移行</button>
          <button className={view === "new" ? "active" : ""} onClick={() => setView("new")}>新規</button>
        </nav>
      )}

      <footer><span>COMPASSION</span><i /> <span>CREATIVITY</span><i /> <span>COMMUNITY</span></footer>
    </main>
  );
}
