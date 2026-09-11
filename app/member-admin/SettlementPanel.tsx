"use client";
import { useCallback, useEffect, useState } from "react";
import { SmaregiSalesSummary, type SmaregiSales } from "./SmaregiSalesSummary";
type Row = {
  id: string;
  source: "ORDER" | "STUDIO";
  reference: string;
  memberCode: string;
  memberName: string;
  amount: number;
  paymentStatus: string;
  serviceStatus: string;
  paymentMethod: string | null;
  transactionId: string | null;
  createdAt: number;
  updatedAt: number;
};
type Data = {
  rows: Row[];
  summary: {
    UNPAID: number;
    PROCESSING: number;
    CUSTOMER_CANCELLED: number;
    ORDER_PENDING: number;
    PAID: number;
    totalAmount: number;
  };
};
const yen = (value: number) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;
const label: Record<string, string> = {
  UNPAID: "利用済み・未精算",
  PROCESSING: "決済処理中",
  CUSTOMER_CANCELLED: "注文キャンセル（お客さま都合）",
  ORDER_PENDING: "注文確定待ち",
  PAID: "精算済み",
  CANCELLED: "取消",
  REFUNDED: "返金済み",
  EXPIRED: "期限切れ",
  STORE: "現地決済",
  STRIPE: "スマート決済",
};
export function SettlementPanel() {
  const [data, setData] = useState<Data | null>(null),
    [status, setStatus] = useState("ALL"),
    [source, setSource] = useState("ALL"),
    [q, setQ] = useState(""),
    [busy, setBusy] = useState(false),
    [cancelling, setCancelling] = useState(""),
    [smaregiSales, setSmaregiSales] = useState<SmaregiSales | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const p = new URLSearchParams({ status, source, q }),
        response = await fetch(`/api/v1/admin/settlements?${p}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }),
        result = await response
          .json()
          .catch(() => ({ error: "INVALID_RESPONSE" }));
      if (response.status === 401) {
        location.replace("/member-admin/login");
        return;
      }
      if (!response.ok)
        throw new Error(result.error ?? `HTTP_${response.status}`);
      setData(result);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "UNKNOWN";
      setError(
        code === "SETTLEMENT_QUERY_FAILED"
          ? "取引台帳の読み込みに失敗しました。管理者へエラーコード SETTLEMENT_QUERY_FAILED をお伝えください"
          : code.startsWith("HTTP_")
            ? `取引情報を取得できませんでした（${code}）`
            : "取引情報の取得が8秒を超えました。もう一度お試しください",
      );
    } finally {
      setBusy(false);
    }
  }, [status, source, q]);
  const cancel = async (row: Row) => {
    if (
      !confirm(
        `${row.reference}（${yen(row.amount)}）を取消しますか？\nスマート決済済みの場合は返金も実行します。`,
      )
    )
      return;
    setCancelling(row.id);
    setError("");
    try {
      const response = await fetch("/api/v1/admin/orders/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: row.id,
            requestId: crypto.randomUUID(),
            reason: "お客さま都合・商品未提供",
          }),
          signal: AbortSignal.timeout(15000),
        }),
        result = await response
          .json()
          .catch(() => ({ error: "INVALID_RESPONSE" }));
      if (!response.ok)
        throw new Error(result.error ?? `HTTP_${response.status}`);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `取消できませんでした：${cause.message}`
          : "取消できませんでした",
      );
    } finally {
      setCancelling("");
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);
  const smaregiRows = (smaregiSales?.transactions ?? []).filter((row) => {
    if (source !== "ALL" && source !== "SMAREGI") return false;
    const rowStatus = row.division === "RETURN" ? "REFUNDED" : "PAID";
    if (status !== "ALL" && status !== rowStatus) return false;
    return (
      !q ||
      `${row.storeName} ${row.receiptNo} ${row.id} ${row.memberCode}`
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  });
  return (
    <section className="operations-panel settlement-panel">
      <header>
        <div>
          <small>TRANSACTIONS / SETTLEMENTS / SALES</small>
          <h2>取引・精算・売上</h2>
          <p>
            スマレジ全店舗の売上と、注文・スタジオの精算状況を確認できます。
          </p>
        </div>
        <button disabled={busy} onClick={() => void load()}>
          {busy ? "更新しています…" : "精算状況を更新"}
        </button>
      </header>
      <SmaregiSalesSummary onLoaded={setSmaregiSales} />
      <div className="settlement-section-heading">
        <small>PAYMENT MANAGEMENT</small>
        <h3>精算・注文の管理</h3>
        <p>未精算、決済待ち、取消、返金を確認します。</p>
      </div>
      {data && (
        <div className="operations-kpi-grid">
          <Kpi
            label="利用済み・未精算"
            value={`${data.summary.UNPAID}件`}
            alert={data.summary.UNPAID > 0}
          />
          <Kpi label="注文確定待ち" value={`${data.summary.ORDER_PENDING}件`} />
          <Kpi
            label="注文キャンセル"
            value={`${data.summary.CUSTOMER_CANCELLED}件`}
          />
          <Kpi label="表示中の精算済み" value={yen(data.summary.totalAmount)} />
        </div>
      )}
      <div className="settlement-toolbar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="会員番号・氏名・注文番号・取引IDで検索"
        />
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="ALL">すべての取引</option>
          <option value="SMAREGI">スマレジ店舗売上</option>
          <option value="ORDER">モバイルオーダー</option>
          <option value="STUDIO">スタジオ</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">全状態</option>
          <option value="UNPAID">利用済み・未精算</option>
          <option value="ORDER_PENDING">注文確定待ち</option>
          <option value="PROCESSING">決済処理中</option>
          <option value="CUSTOMER_CANCELLED">注文キャンセル</option>
          <option value="PAID">精算済み</option>
        </select>
      </div>
      {error && (
        <p className="member-admin-message" role="alert">
          {error}
        </p>
      )}
      {(source === "ALL" || source === "SMAREGI") && (
        <div className="smaregi-ledger-section">
          <h4>スマレジ店舗売上</h4>
          <p>おもひで商店を含む、上で選択した日の店舗会計です。</p>
          {smaregiSales ? (
            smaregiRows.length ? (
              <div className="settlement-table-wrap">
                <table className="settlement-table">
                  <thead>
                    <tr>
                      <th>日時</th>
                      <th>店舗・レシート</th>
                      <th>会員番号</th>
                      <th>金額</th>
                      <th>状態</th>
                      <th>取引ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smaregiRows.map((row) => (
                      <tr key={`smaregi-${row.id}`}>
                        <td>
                          {row.occurredAt
                            ? new Date(row.occurredAt).toLocaleString("ja-JP", {
                                timeZone: "Asia/Tokyo",
                                month: "numeric",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td>
                          <b>{row.storeName}</b>
                          <small>
                            {row.receiptNo
                              ? `レシート ${row.receiptNo}`
                              : "レシート番号なし"}
                          </small>
                        </td>
                        <td>
                          <small>{row.memberCode || "会員紐付けなし"}</small>
                        </td>
                        <td className="settlement-amount">{yen(row.amount)}</td>
                        <td>
                          <span
                            className={`settlement-status ${row.division === "RETURN" ? "refunded" : "paid"}`}
                          >
                            {row.division === "RETURN" ? "返品" : "精算済み"}
                          </span>
                        </td>
                        <td>
                          <small>{row.id}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-empty">条件に該当する店舗売上はありません</p>
            )
          ) : (
            <p className="admin-empty">店舗売上を読み込んでいます…</p>
          )}
        </div>
      )}
      {!data && !error ? (
        <p className="admin-empty">統合取引台帳を読み込んでいます…</p>
      ) : data?.rows.length ? (
        <div className="settlement-table-wrap">
          <table className="settlement-table">
            <thead>
              <tr>
                <th>日時</th>
                <th>種別・番号</th>
                <th>会員</th>
                <th>金額</th>
                <th>支払方法</th>
                <th>状態</th>
                <th>取引ID</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={`${row.source}-${row.id}`}>
                  <td>
                    {new Date(row.updatedAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    <b>{row.source === "ORDER" ? "注文" : "スタジオ"}</b>
                    <small>{row.reference}</small>
                  </td>
                  <td>
                    <strong>{row.memberName}</strong>
                    <small>{row.memberCode}</small>
                  </td>
                  <td className="settlement-amount">{yen(row.amount)}</td>
                  <td>
                    {label[row.paymentMethod ?? ""] ??
                      row.paymentMethod ??
                      "未設定"}
                  </td>
                  <td>
                    <span
                      className={`settlement-status ${row.paymentStatus.toLowerCase()}`}
                    >
                      {label[row.paymentStatus] ?? row.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <small>{row.transactionId ?? "—"}</small>
                  </td>
                  <td>
                    {row.source === "ORDER" &&
                    !["CANCELLED", "REFUNDED", "CUSTOMER_CANCELLED"].includes(
                      row.paymentStatus,
                    ) ? (
                      <button
                        disabled={Boolean(cancelling)}
                        onClick={() => void cancel(row)}
                      >
                        {cancelling === row.id
                          ? "取消処理中…"
                          : row.paymentMethod === "STRIPE" && row.transactionId
                            ? "取消・返金"
                            : "注文を取消"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        data && (
          <p className="admin-empty">条件に該当する取引情報はありません</p>
        )
      )}
    </section>
  );
}
function Kpi({
  label: caption,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <article className={alert ? "alert" : ""}>
      <small>{caption}</small>
      <strong>{value}</strong>
    </article>
  );
}
