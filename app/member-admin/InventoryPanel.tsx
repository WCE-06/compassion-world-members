"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Product = {
  code: string;
  name: string;
  category: string;
  soldOut: boolean;
  saleEndsAt: number | null;
  inventoryManaged: boolean;
  managementNote: string;
};
type Lot = {
  id: string;
  productCode: string;
  productName: string;
  receivedQuantity: number;
  remainingQuantity: number;
  expiryDate: string | null;
  discountRate: number;
  note: string;
};
type Stock = {
  productCode: string;
  storeId: string;
  stockAmount: number;
  layawayStockAmount: number;
  syncedAt: number;
};
type CountItem = {
  productCode: string;
  productName: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  difference: number | null;
  note: string;
};
type Data = {
  configured: boolean;
  products: Product[];
  lots: Lot[];
  stocks: Stock[];
  count: { id: string; startedAt: number; items: CountItem[] } | null;
};
const days = (date: string | null) =>
  date
    ? Math.ceil((Date.parse(`${date}T00:00:00+09:00`) - Date.now()) / 86400000)
    : null;

export function InventoryPanel() {
  const [data, setData] = useState<Data | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [q, setQ] = useState(""),
    [receiveQuery, setReceiveQuery] = useState(""),
    [showNewProduct, setShowNewProduct] = useState(false),
    [newProduct, setNewProduct] = useState({
      productCode: "",
      name: "",
      priceExcludingTax: "",
      taxRate: "10",
      category: "RETAIL",
    }),
    [filter, setFilter] = useState<"ALL" | "MANAGED" | "EXCLUDED">("ALL"),
    [form, setForm] = useState({
      productCode: "",
      quantity: "1",
      expiryDate: "",
      note: "",
    });
  const load = useCallback(async (refresh = false) => {
    setBusy(refresh ? "SYNC" : "LOAD");
    setMessage(refresh ? "スマレジの商品マスタと実在庫を取得しています…" : "");
    try {
      const response = await fetch(
          `/api/v1/admin/inventory${refresh ? "?refresh=1" : ""}`,
          { cache: "no-store", signal: AbortSignal.timeout(15000) },
        ),
        result = await response.json();
      if (response.status === 401) {
        location.replace("/member-admin/login");
        return;
      }
      if (!response.ok) throw new Error(result.error);
      setData(result);
      if (refresh)
        setMessage(
          result.configured
            ? `商品マスタ${result.products.length}件と実在庫を更新しました`
            : "スマレジ在庫APIの接続設定待ちです",
        );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `在庫を取得できませんでした（${error.message}）`
          : "在庫を取得できませんでした",
      );
    } finally {
      setBusy("");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const products = useMemo(
    () =>
      data?.products.filter(
        (p) =>
          (filter === "ALL" ||
            (filter === "MANAGED" && p.inventoryManaged) ||
            (filter === "EXCLUDED" && !p.inventoryManaged)) &&
          (!q || `${p.code} ${p.name}`.toLowerCase().includes(q.toLowerCase())),
      ) ?? [],
    [data, q, filter],
  );
  const managedProducts = useMemo(
    () => data?.products.filter((p) => p.inventoryManaged) ?? [],
    [data],
  );
  const stockMap = useMemo(
    () => new Map((data?.stocks ?? []).map((s) => [s.productCode, s])),
    [data],
  );
  const post = async (body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(String(body.action));
    setMessage("処理を反映しています…");
    try {
      const response = await fetch("/api/v1/admin/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(
        result.smaregi === "WAITING"
          ? "台帳へ保存しました。スマレジ接続後に在庫へ反映します"
          : "反映しました",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `処理できませんでした（${error.message}）`
          : "処理できませんでした",
      );
    } finally {
      setBusy("");
    }
  };
  const selected = data?.products.find((p) => p.code === form.productCode);
  const receiveMatches = useMemo(() => {
    const needle = receiveQuery.trim().toLowerCase();
    if (!needle) return [];
    return managedProducts
      .filter((product) =>
        `${product.code} ${product.name}`.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [managedProducts, receiveQuery]);
  const searchProduct = () => {
    const exact = receiveMatches.find(
      (product) =>
        product.code.toLowerCase() === receiveQuery.trim().toLowerCase(),
    );
    if (exact || receiveMatches.length === 1) {
      const product = exact ?? receiveMatches[0];
      setForm((value) => ({ ...value, productCode: product.code }));
      setReceiveQuery(`${product.name}（${product.code}）`);
      setShowNewProduct(false);
      return;
    }
    if (!receiveMatches.length && receiveQuery.trim()) {
      const scanned = receiveQuery.trim();
      const looksLikeCode = /^[A-Za-z0-9_-]{4,40}$/.test(scanned);
      setNewProduct((value) => ({
        ...value,
        productCode: looksLikeCode ? scanned : "",
        name: looksLikeCode ? "" : scanned,
      }));
      setShowNewProduct(true);
    }
  };
  const createProductForReceipt = async () => {
    if (busy) return;
    setBusy("CREATE_PRODUCT");
    setMessage("商品マスタへ登録しています…");
    try {
      const response = await fetch("/api/v1/admin/product-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProduct,
          janCode: newProduct.productCode,
          priceExcludingTax: Number(newProduct.priceExcludingTax),
          costPrice: null,
          pointEligible: true,
          active: true,
          saleStartsAt: null,
          saleEndsAt: null,
          requestId: crypto.randomUUID(),
        }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.message ?? result.error ?? "REGISTER_FAILED");
      await fetch("/api/v1/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_TRACKING",
          productCode: newProduct.productCode,
          productName: newProduct.name,
          inventoryManaged: true,
        }),
        signal: AbortSignal.timeout(15000),
      });
      setForm((value) => ({
        ...value,
        productCode: newProduct.productCode,
      }));
      setReceiveQuery(`${newProduct.name}（${newProduct.productCode}）`);
      setShowNewProduct(false);
      setMessage("商品を登録しました。続けて入荷数と期限を入力してください");
      await load(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `商品を登録できませんでした（${error.message}）`
          : "商品を登録できませんでした",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="operations-panel inventory-panel">
      <header>
        <div>
          <small>PRODUCTS & INVENTORY</small>
          <h2>商品・在庫・販売期限</h2>
          <p>
            スマレジの商品マスタ全件を対象に、在庫管理する商品だけ期限・棚卸差異を管理します。
          </p>
        </div>
        <button disabled={Boolean(busy)} onClick={() => void load(true)}>
          {busy === "SYNC" ? "商品・在庫を同期中…" : "商品マスタ・実在庫を更新"}
        </button>
      </header>
      {message && (
        <p className="member-admin-message" role="status">
          {message}
        </p>
      )}
      <div className="inventory-summary">
        <Kpi label="商品マスタ" value={`${data?.products.length ?? 0}件`} />
        <Kpi label="在庫管理対象" value={`${managedProducts.length}件`} />
        <Kpi
          label="管理対象外"
          value={`${(data?.products.length ?? 0) - managedProducts.length}件`}
        />
        <Kpi
          label="期限7日以内"
          value={`${
            data?.lots.filter((l) => {
              const d = days(l.expiryDate);
              return d !== null && d >= 0 && d <= 7;
            }).length ?? 0
          }件`}
          alert
        />
        <Kpi label="棚卸" value={data?.count ? "実施中" : "未実施"} />
      </div>
      <div
        className={`operations-connection ${data?.configured ? "ready" : "waiting"}`}
      >
        <strong>スマレジ商品・在庫API</strong>
        <span>
          {data?.configured
            ? "接続済み。更新すると飲食物以外を含む商品マスタ全件を取得します。"
            : "接続設定待ち。期限ロット台帳は先に利用できます。"}
        </span>
      </div>
      <section className="inventory-products">
        <header>
          <div>
            <small>INVENTORY POLICY</small>
            <h3>商品別の在庫管理設定</h3>
            <p>
              通常はオンのまま使用します。無形サービスや都度調理品はオフにすると、入荷・棚卸し・差異補正の対象から外れます。
            </p>
          </div>
          <div className="inventory-product-tools">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="ALL">すべて</option>
              <option value="MANAGED">在庫管理対象</option>
              <option value="EXCLUDED">在庫管理対象外</option>
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="商品名・商品コードで検索"
            />
          </div>
        </header>
        <div className="inventory-product-grid">
          {products.map((product) => {
            const stock = stockMap.get(product.code);
            return (
              <article
                key={product.code}
                className={
                  !product.inventoryManaged ? "inventory-excluded" : ""
                }
              >
                <div className="inventory-product-name">
                  <strong>{product.name}</strong>
                  <small>
                    {product.code}　{product.category}
                  </small>
                </div>
                <b className="inventory-product-stock">
                  {product.inventoryManaged
                    ? stock
                      ? `${stock.stockAmount - stock.layawayStockAmount}点`
                      : "在庫未取得"
                    : "在庫管理対象外"}
                </b>
                <label className="inventory-toggle">
                  <input
                    type="checkbox"
                    checked={product.inventoryManaged}
                    disabled={Boolean(busy)}
                    onChange={(e) =>
                      void post({
                        action: "SET_TRACKING",
                        productCode: product.code,
                        productName: product.name,
                        inventoryManaged: e.target.checked,
                        managementNote: e.target.checked
                          ? ""
                          : "無形サービス・都度調理品等",
                      })
                    }
                  />
                  <span>在庫を管理する</span>
                </label>
                <span className="inventory-product-state">
                  {product.inventoryManaged
                    ? product.soldOut
                      ? "売り切れ"
                      : product.saleEndsAt
                        ? `販売終了 ${new Date(product.saleEndsAt).toLocaleDateString("ja-JP")}`
                        : "販売中"
                    : "棚卸し・期限管理から除外"}
                </span>
              </article>
            );
          })}
        </div>
        <a className="operations-primary-link" href="/menu-admin">
          商品マスタ・画像・掲載設定を開く
        </a>
      </section>
      <div className="inventory-layout">
        <article className="inventory-receive">
          <small>STOCK RECEIPT</small>
          <h3>かんたん入荷登録</h3>
          <p>バーコードを読み取るか、商品名を入力してください。</p>
          <div className="inventory-receive-search">
            <label>
              バーコード・商品名
              <input
                value={receiveQuery}
                placeholder="読み取り、または商品名を入力"
                onChange={(event) => {
                  setReceiveQuery(event.target.value);
                  setForm((value) => ({ ...value, productCode: "" }));
                  setShowNewProduct(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    searchProduct();
                  }
                }}
              />
            </label>
            <button
              type="button"
              disabled={!receiveQuery.trim()}
              onClick={searchProduct}
            >
              登録を確認
            </button>
          </div>
          {!selected && receiveQuery.trim() && receiveMatches.length > 1 && (
            <div className="inventory-receive-results">
              <small>該当する商品を選択</small>
              {receiveMatches.map((product) => (
                <button
                  type="button"
                  key={product.code}
                  onClick={() => {
                    setForm((value) => ({
                      ...value,
                      productCode: product.code,
                    }));
                    setReceiveQuery(`${product.name}（${product.code}）`);
                  }}
                >
                  <strong>{product.name}</strong>
                  <span>{product.code}</span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="inventory-selected-product">
              <small>登録済み商品</small>
              <strong>{selected.name}</strong>
              <span>{selected.code}</span>
              <button
                type="button"
                onClick={() => {
                  setReceiveQuery("");
                  setForm((value) => ({ ...value, productCode: "" }));
                }}
              >
                商品を選び直す
              </button>
            </div>
          )}
          {showNewProduct && (
            <div className="inventory-new-product">
              <small>商品マスタに登録がありません</small>
              <strong>このまま新しい商品として登録</strong>
              <label>
                商品コード・バーコード
                <input
                  value={newProduct.productCode}
                  onChange={(event) =>
                    setNewProduct((value) => ({
                      ...value,
                      productCode: event.target.value.trim(),
                    }))
                  }
                />
              </label>
              <label>
                商品名
                <input
                  value={newProduct.name}
                  onChange={(event) =>
                    setNewProduct((value) => ({
                      ...value,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                税抜価格
                <input
                  type="number"
                  min="0"
                  value={newProduct.priceExcludingTax}
                  onChange={(event) =>
                    setNewProduct((value) => ({
                      ...value,
                      priceExcludingTax: event.target.value,
                    }))
                  }
                />
              </label>
              <div>
                <label>
                  税率
                  <select
                    value={newProduct.taxRate}
                    onChange={(event) =>
                      setNewProduct((value) => ({
                        ...value,
                        taxRate: event.target.value,
                      }))
                    }
                  >
                    <option value="10">10%</option>
                    <option value="8">8%</option>
                  </select>
                </label>
                <label>
                  分類
                  <select
                    value={newProduct.category}
                    onChange={(event) =>
                      setNewProduct((value) => ({
                        ...value,
                        category: event.target.value,
                      }))
                    }
                  >
                    <option value="RETAIL">物販</option>
                    <option value="FOOD">フード</option>
                    <option value="DRINK">ドリンク</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                disabled={
                  busy === "CREATE_PRODUCT" ||
                  !newProduct.productCode ||
                  !newProduct.name ||
                  newProduct.priceExcludingTax === ""
                }
                onClick={() => void createProductForReceipt()}
              >
                {busy === "CREATE_PRODUCT"
                  ? "商品を登録中…"
                  : "商品マスタへ登録して入荷を続ける"}
              </button>
            </div>
          )}
          <label>
            入荷数
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) =>
                setForm((v) => ({ ...v, quantity: e.target.value }))
              }
            />
          </label>
          <label>
            消費・賞味期限
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) =>
                setForm((v) => ({ ...v, expiryDate: e.target.value }))
              }
            />
          </label>
          <label>
            備考
            <input
              value={form.note}
              onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))}
            />
          </label>
          <button
            disabled={
              !selected ||
              !selected.inventoryManaged ||
              Number(form.quantity) < 1 ||
              Boolean(busy)
            }
            onClick={() =>
              void post({
                action: "RECEIVE",
                productCode: selected?.code,
                productName: selected?.name,
                quantity: Number(form.quantity),
                expiryDate: form.expiryDate,
                note: form.note,
              })
            }
          >
            {busy === "RECEIVE" ? "登録中…" : "入荷を登録"}
          </button>
        </article>
        <article className="inventory-lots">
          <small>EXPIRY & DISCOUNT</small>
          <h3>期限・値引き管理</h3>
          {data?.lots.length ? (
            data.lots.map((lot) => {
              const remain = days(lot.expiryDate);
              return (
                <div
                  key={lot.id}
                  className={remain !== null && remain <= 3 ? "urgent" : ""}
                >
                  <span>
                    <strong>{lot.productName}</strong>
                    <small>
                      {lot.productCode}　残り{lot.remainingQuantity}点
                    </small>
                  </span>
                  <span>
                    <b>{lot.expiryDate ?? "期限なし"}</b>
                    <small>
                      {remain === null
                        ? ""
                        : remain < 0
                          ? "期限超過"
                          : `あと${remain}日`}
                    </small>
                  </span>
                  <label>
                    値引率
                    <select
                      value={lot.discountRate}
                      onChange={(e) =>
                        void post({
                          action: "SET_DISCOUNT",
                          id: lot.id,
                          discountRate: Number(e.target.value),
                        })
                      }
                    >
                      {[0, 10, 20, 30, 40, 50].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })
          ) : (
            <p>期限ロットはまだありません。</p>
          )}
        </article>
      </div>
      <section className="inventory-count">
        <header>
          <div>
            <small>STOCKTAKING</small>
            <h3>棚卸し・差異確認</h3>
          </div>
          {!data?.count && (
            <button
              disabled={Boolean(busy) || managedProducts.length === 0}
              onClick={() => void post({ action: "START_COUNT" })}
            >
              棚卸しを開始
            </button>
          )}
        </header>
        {data?.count && (
          <>
            <p>
              在庫管理対象の商品だけを表示しています。スマレジ実在庫を基準に実数を入力してください。
            </p>
            <div className="inventory-count-table">
              <table>
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>帳簿</th>
                    <th>実数</th>
                    <th>差異</th>
                  </tr>
                </thead>
                <tbody>
                  {data.count.items.map((item) => (
                    <tr key={item.productCode}>
                      <td>
                        <strong>{item.productName}</strong>
                        <small>{item.productCode}</small>
                      </td>
                      <td>{item.expectedQuantity}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          defaultValue={item.countedQuantity ?? ""}
                          onBlur={(e) =>
                            void post({
                              action: "SAVE_COUNT",
                              countId: data.count?.id,
                              productCode: item.productCode,
                              countedQuantity: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td
                        className={
                          Number(item.difference) !== 0 ? "difference" : ""
                        }
                      >
                        {item.difference ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="inventory-complete"
              disabled={
                Boolean(busy) ||
                data.count.items.some((i) => i.countedQuantity === null)
              }
              onClick={() => {
                if (
                  confirm(
                    "入力した実数で棚卸しを完了し、差異をスマレジへ反映しますか？",
                  )
                )
                  void post({
                    action: "COMPLETE_COUNT",
                    countId: data.count?.id,
                  });
              }}
            >
              差異を確認して棚卸しを完了
            </button>
          </>
        )}
      </section>
    </section>
  );
}
function Kpi({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <article className={alert ? "alert" : ""}>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}
