"use client";
import { useCallback, useEffect, useState } from "react";
export type SmaregiTransaction = {
  id: string;
  receiptNo: string;
  storeId: string;
  storeName: string;
  amount: number;
  occurredAt: string;
  memberCode: string;
  division: "SALE" | "RETURN";
};
export type SmaregiSales = {
  available: boolean;
  date: string;
  amount: number;
  stores: {
    storeId: string;
    name: string;
    amount: number;
    transactionCount: number;
  }[];
  transactions: SmaregiTransaction[];
  transactionCount: number;
  syncedAt: string;
};
const yen = (value: number) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;
const today = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function SmaregiSalesSummary({
  onLoaded,
}: {
  onLoaded?: (sales: SmaregiSales) => void;
}) {
  const [date, setDate] = useState(today),
    [sales, setSales] = useState<SmaregiSales | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
          `/api/v1/admin/sales-summary?date=${encodeURIComponent(date)}`,
          { cache: "no-store", signal: AbortSignal.timeout(22000) },
        ),
        result = await response
          .json()
          .catch(() => ({ error: "INVALID_RESPONSE" }));
      if (response.status === 401) {
        location.replace("/member-admin/login");
        return;
      }
      if (!response.ok || !result.available)
        throw new Error(result.error ?? `HTTP_${response.status}`);
      setSales(result);
      onLoaded?.(result);
    } catch {
      setSales(null);
      setError(
        "スマレジ売上を取得できませんでした。精算・注文情報はそのまま利用できます。時間をおいて再取得してください",
      );
    } finally {
      setBusy(false);
    }
  }, [date, onLoaded]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="smaregi-sales-card">
      <header>
        <div>
          <small>SMAREGI ALL STORES</small>
          <h3>スマレジ全店舗売上</h3>
          <p>おもひで商店を含む、選択日のスマレジ売上です。</p>
        </div>
        <div className="smaregi-sales-actions">
          <label>
            売上日
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <button disabled={busy} onClick={() => void load()}>
            {busy ? "売上を取得中…" : "売上を再取得"}
          </button>
        </div>
      </header>
      {busy && !sales && (
        <p className="sales-loading" role="status">
          スマレジから全店舗の売上を集計しています…
        </p>
      )}
      {error && (
        <p className="member-admin-message" role="alert">
          {error}
        </p>
      )}
      {sales && (
        <>
          <div className="sales-total">
            <span>全店舗合計</span>
            <strong>{yen(sales.amount)}</strong>
            <small>{sales.transactionCount}件の取引</small>
          </div>
          <div className="sales-store-grid">
            {sales.stores.length ? (
              sales.stores.map((store) => (
                <article key={store.storeId || store.name}>
                  <span>{store.name}</span>
                  <strong>{yen(store.amount)}</strong>
                  <small>{store.transactionCount}件</small>
                </article>
              ))
            ) : (
              <p>店舗別内訳はありません</p>
            )}
          </div>
          <p className="sales-updated">
            最終取得{" "}
            {new Date(sales.syncedAt).toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </>
      )}
    </section>
  );
}
