"use client";
import { useCallback, useEffect, useState } from "react";
export type SmaregiTransaction = {
  id: string;
  receiptNo: string;
  storeId: string;
  storeName: string;
  amount: number;
  tax: number;
  discount: number;
  occurredAt: string;
  memberCode: string;
  paymentMethod: string;
  staffName: string;
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
    customerCount: number;
    returnAmount: number;
  }[];
  transactions: SmaregiTransaction[];
  products: { productId: string; name: string; quantity: number; amount: number }[];
  payments: { method: string; amount: number; transactionCount: number }[];
  hourly: { hour: string; amount: number; transactionCount: number }[];
  transactionCount: number;
  customerCount: number;
  returnAmount: number;
  discountAmount: number;
  taxAmount: number;
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
    [query, setQuery] = useState(""),
    [view, setView] = useState<"stores" | "products" | "hours" | "receipts">("stores"),
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
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  const filteredTransactions = (sales?.transactions ?? []).filter((row) =>
    !query ||
    `${row.storeName} ${row.receiptNo} ${row.id} ${row.memberCode} ${row.paymentMethod} ${row.staffName}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const exportCsv = () => {
    if (!sales) return;
    const header = ["日時", "店舗", "レシート", "会員番号", "支払手段", "区分", "金額", "税", "値引", "担当", "取引ID"];
    const rows = filteredTransactions.map((row) => [
      row.occurredAt,
      row.storeName,
      row.receiptNo,
      row.memberCode,
      row.paymentMethod,
      row.division,
      row.amount,
      row.tax,
      row.discount,
      row.staffName,
      row.id,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `smaregi-sales-${sales.date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const average = sales?.customerCount
    ? Math.round(sales.amount / sales.customerCount)
    : sales?.transactionCount
      ? Math.round(sales.amount / sales.transactionCount)
      : 0;
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
          <button disabled={!sales} className="secondary" onClick={exportCsv}>
            CSV
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
            <small>
              {sales.transactionCount}件の取引
              {sales.customerCount ? ` / 客数 ${sales.customerCount}名` : ""}
            </small>
          </div>
          <div className="sales-practical-kpis">
            <article><small>客単価</small><strong>{yen(average)}</strong></article>
            <article><small>返品</small><strong>{yen(sales.returnAmount)}</strong></article>
            <article><small>値引</small><strong>{yen(sales.discountAmount)}</strong></article>
            <article><small>消費税</small><strong>{yen(sales.taxAmount)}</strong></article>
          </div>
          <div className="sales-payment-grid">
            {(sales.payments.length ? sales.payments : [{ method: "未分類", amount: sales.amount, transactionCount: sales.transactionCount }]).map((payment) => (
              <article key={payment.method}>
                <span>{payment.method}</span>
                <strong>{yen(payment.amount)}</strong>
                <small>{payment.transactionCount}件</small>
              </article>
            ))}
          </div>
          <nav className="sales-view-tabs" aria-label="売上の表示切替">
            <button className={view === "stores" ? "active" : ""} onClick={() => setView("stores")}>店舗別</button>
            <button className={view === "products" ? "active" : ""} onClick={() => setView("products")}>商品別</button>
            <button className={view === "hours" ? "active" : ""} onClick={() => setView("hours")}>時間帯</button>
            <button className={view === "receipts" ? "active" : ""} onClick={() => setView("receipts")}>取引明細</button>
          </nav>
          {view === "stores" && (
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
          )}
          {view === "products" && (
            <div className="sales-ranking-list">
              {sales.products.length ? sales.products.slice(0, 20).map((product, index) => (
                <article key={`${product.productId}-${product.name}`}>
                  <b>{index + 1}</b><span><strong>{product.name}</strong><small>{product.quantity}点</small></span><em>{yen(product.amount)}</em>
                </article>
              )) : <p>商品別売上は取得元から返っていません。</p>}
            </div>
          )}
          {view === "hours" && (
            <div className="sales-ranking-list">
              {sales.hourly.length ? sales.hourly.map((hour) => (
                <article key={hour.hour}>
                  <b>{hour.hour}</b><span><strong>{yen(hour.amount)}</strong><small>{hour.transactionCount}件</small></span><i style={{ width: `${Math.max(6, Math.round((hour.amount / Math.max(...sales.hourly.map((row) => row.amount), 1)) * 100))}%` }} />
                </article>
              )) : <p>時間帯別売上は取得元から返っていません。</p>}
            </div>
          )}
          {view === "receipts" && (
            <div className="sales-receipts">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="店舗・レシート・会員番号・支払手段で検索" />
              <div>
                {filteredTransactions.slice(0, 80).map((row) => (
                  <article key={row.id}>
                    <span><strong>{row.storeName}</strong><small>{row.receiptNo || row.id}</small></span>
                    <span><b>{yen(row.amount)}</b><small>{row.paymentMethod || "支払手段未取得"} / {row.division === "RETURN" ? "返品" : "売上"}</small></span>
                  </article>
                ))}
                {!filteredTransactions.length && <p>条件に該当する取引明細はありません。</p>}
              </div>
            </div>
          )}
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
