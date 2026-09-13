"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Product = {
  code: string;
  name: string;
  category: string;
  categoryId: string;
  categoryName: string;
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
type Supplier = { id: string; name: string; lastUsedAt: number };
type PurchasePrice = {
  productCode: string;
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  isLimitedPrice: number;
  purchasedAt: number;
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
  suppliers: Supplier[];
  purchasePrices: PurchasePrice[];
  count: { id: string; startedAt: number; items: CountItem[] } | null;
};
const days = (date: string | null) =>
  date
    ? Math.ceil((Date.parse(`${date}T00:00:00+09:00`) - Date.now()) / 86400000)
    : null;

export function InventoryPanel({ onOpenProducts }: { onOpenProducts: () => void }) {
  const [data, setData] = useState<Data | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [categories, setCategories] = useState<[string, string][]>([]),
    [receiveQuery, setReceiveQuery] = useState(""),
    [cameraOpen, setCameraOpen] = useState(false),
    [showNewProduct, setShowNewProduct] = useState(false),
    [newProduct, setNewProduct] = useState({
      productCode: "",
      name: "",
      priceExcludingTax: "",
      costIncludingTax: "",
      costExcludingTax: "",
      taxRate: "10",
      category: "",
    }),
    [form, setForm] = useState({
      productCode: "",
      quantity: "1",
      expiryDate: "",
      noExpiry: false,
      supplierName: "",
      unitPrice: "",
      isLimitedPrice: false,
      note: "",
    });
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const scanFrame = useRef<number | null>(null);
  const categorySyncAttempted = useRef(false);
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
  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/inventory?view=categories", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.replace("/member-admin/login");
        return [] as [string, string][];
      }
      if (!response.ok) throw new Error(result.error);
      const values = (result.categories ?? []).map(
        (row: { id: string; name: string }) => [row.id, row.name] as [string, string],
      );
      setCategories(values);
      return values;
    } catch {
      return [] as [string, string][];
    }
  }, []);
  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);
  const managedProducts = useMemo(
    () => data?.products.filter((p) => p.inventoryManaged) ?? [],
    [data],
  );
  const smaregiCategories = useMemo(() => {
    if (categories.length) return categories;
    return Array.from(
        new Map(
          (data?.products ?? [])
            .filter((product) => product.categoryId)
            .map((product) => [product.categoryId, product.categoryName]),
        ).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1], "ja"));
  }, [categories, data]);
  useEffect(() => {
    if (
      data &&
      smaregiCategories.length === 0 &&
      !categorySyncAttempted.current
    ) {
      categorySyncAttempted.current = true;
      void load(true).then(() => loadCategories());
    }
  }, [data, load, loadCategories, smaregiCategories.length]);
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
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `処理できませんでした（${error.message}）`
          : "処理できませんでした",
      );
      return false;
    } finally {
      setBusy("");
    }
  };
  const selected = data?.products.find((p) => p.code === form.productCode);
  const selectedPriceRanking = useMemo(
    () =>
      (data?.purchasePrices ?? [])
        .filter((price) => price.productCode === form.productCode)
        .sort((a, b) => a.unitPrice - b.unitPrice || b.purchasedAt - a.purchasedAt),
    [data, form.productCode],
  );
  const receiveMatches = useMemo(() => {
    const needle = receiveQuery.trim().toLowerCase();
    if (!needle) return [];
    return managedProducts
      .filter((product) =>
        `${product.code} ${product.name}`.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [managedProducts, receiveQuery]);
  const searchProduct = (searchValue = receiveQuery) => {
    const needle = searchValue.trim().toLowerCase();
    const matches = managedProducts
      .filter((product) =>
        `${product.code} ${product.name}`.toLowerCase().includes(needle),
      )
      .slice(0, 8);
    const exact = matches.find(
      (product) => product.code.toLowerCase() === needle,
    );
    if (exact || matches.length === 1) {
      const product = exact ?? matches[0];
      setForm((value) => ({ ...value, productCode: product.code }));
      setReceiveQuery(`${product.name}（${product.code}）`);
      setShowNewProduct(false);
      return;
    }
    if (!matches.length && searchValue.trim()) {
      const scanned = searchValue.trim();
      const looksLikeCode = /^[A-Za-z0-9_-]{4,40}$/.test(scanned);
      setNewProduct((value) => ({
        ...value,
        productCode: looksLikeCode ? scanned : "",
        name: looksLikeCode ? "" : scanned,
      }));
      setShowNewProduct(true);
    }
  };
  const stopCamera = useCallback(() => {
    if (scanFrame.current !== null) cancelAnimationFrame(scanFrame.current);
    scanFrame.current = null;
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    setCameraOpen(false);
  }, []);
  useEffect(() => stopCamera, [stopCamera]);
  const startCamera = async () => {
    type Detector = {
      detect: (source: ImageBitmapSource) => Promise<{ rawValue?: string }[]>;
    };
    type DetectorConstructor = new (options?: {
      formats?: string[];
    }) => Detector;
    const Detector = (
      window as unknown as { BarcodeDetector?: DetectorConstructor }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setMessage(
        "この端末ではカメラ読取を利用できません。入力欄または外付けリーダーをご利用ください",
      );
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      cameraStream.current = stream;
      setCameraOpen(true);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const video = videoRef.current;
      if (!video) throw new Error("CAMERA_NOT_READY");
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({
        formats: [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
          "itf",
        ],
      });
      const scan = async () => {
        try {
          const values = await detector.detect(video);
          const value = values[0]?.rawValue?.trim();
          if (value) {
            setReceiveQuery(value);
            stopCamera();
            searchProduct(value);
            setMessage("バーコードを読み取りました");
            return;
          }
        } catch {
          // 映像が準備できるまで次のフレームで再試行する。
        }
        scanFrame.current = requestAnimationFrame(() => void scan());
      };
      void scan();
    } catch {
      stopCamera();
      setMessage(
        "カメラを開始できませんでした。カメラの利用を許可して、もう一度お試しください",
      );
    }
  };
  const createProductForReceipt = async () => {
    if (busy) return;
    if (!newProduct.name.trim()) {
      setMessage("商品名を入力してください");
      return;
    }
    if (
      newProduct.priceExcludingTax.trim() === "" ||
      Number(newProduct.priceExcludingTax) < 0
    ) {
      setMessage("税抜価格を0円以上で入力してください");
      return;
    }
    if (!newProduct.category) {
      setMessage("スマレジの商品ジャンルを選択してください");
      return;
    }
    const costPrice = Number(newProduct.costExcludingTax);
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      setMessage("仕入原価を税込または税抜で入力してください");
      return;
    }
    setBusy("CREATE_PRODUCT");
    setMessage("商品マスタへ登録しています…");
    try {
      const productCode =
        newProduct.productCode.trim() ||
        `CW${Date.now().toString(36).toUpperCase()}`;
      const response = await fetch("/api/v1/admin/product-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProduct,
          productCode,
          janCode: newProduct.productCode.trim() || null,
          priceExcludingTax: Number(newProduct.priceExcludingTax),
          costPrice,
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
      const trackingResponse = await fetch("/api/v1/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_TRACKING",
          productCode,
          productName: newProduct.name,
          inventoryManaged: true,
          categoryId: newProduct.category,
          categoryName:
            smaregiCategories.find(([id]) => id === newProduct.category)?.[1] ??
            newProduct.category,
          price: Number(newProduct.priceExcludingTax),
          cost: costPrice,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const trackingResult = await trackingResponse.json().catch(() => ({}));
      if (!trackingResponse.ok)
        throw new Error(
          trackingResult.error ?? result.message ?? result.error ?? "REGISTER_FAILED",
        );
      setForm((value) => ({
        ...value,
        productCode,
      }));
      setReceiveQuery(`${newProduct.name}（${productCode}）`);
      setShowNewProduct(false);
      setMessage("スマレジへ商品を登録しました。続けて入荷数と期限を入力してください");
      await load();
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
          <small>STOCK OPERATIONS</small>
          <h2>入荷・在庫・棚卸</h2>
          <p>
            入荷、期限、実在庫、棚卸を扱います。商品情報と販売設定は商品マスタへ統合しました。
          </p>
        </div>
        <button disabled={Boolean(busy)} onClick={() => void load(true)}>
          {busy === "SYNC" ? "入荷対象・在庫を同期中…" : "入荷対象・実在庫を更新"}
        </button>
      </header>
      {message && (
        <p className="member-admin-message inventory-status-message" role="status">
          {message}
        </p>
      )}
      <nav className="inventory-primary-actions" aria-label="入荷・商品管理">
        <a href="#quick-stock-receipt">かんたん入荷登録へ</a>
        <button type="button" onClick={onOpenProducts}>商品マスタ・販売設定へ</button>
      </nav>
      <div className="inventory-summary">
        <Kpi label="入荷対象商品" value={`${data?.products.length ?? 0}件`} />
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
      <div className="inventory-layout">
        <article className="inventory-receive" id="quick-stock-receipt">
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
            <button
              type="button"
              className="camera-scan-button"
              onClick={() => (cameraOpen ? stopCamera() : void startCamera())}
            >
              {cameraOpen ? "カメラを閉じる" : "スマホカメラで読み取る"}
            </button>
          </div>
          {cameraOpen && (
            <div className="inventory-camera-reader">
              <video
                ref={videoRef}
                muted
                playsInline
                aria-label="バーコード読み取りカメラ"
              />
              <span>枠の中にバーコードを合わせてください</span>
            </div>
          )}
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
          {selected && selectedPriceRanking.length > 0 && (
            <div className="inventory-price-ranking">
              <small>この商品の仕入れ価格ランキング</small>
              {selectedPriceRanking.map((price, index) => (
                <div key={price.supplierId}>
                  <b>{index + 1}</b>
                  <span>
                    <strong>{price.supplierName}</strong>
                    <small>
                      最終仕入れ {new Date(price.purchasedAt).toLocaleDateString("ja-JP")}
                      {price.isLimitedPrice ? "・期間限定価格" : ""}
                    </small>
                  </span>
                  <em>税込 ¥{price.unitPrice.toLocaleString()}/個</em>
                </div>
              ))}
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
                  仕入原価（税込）
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={newProduct.costIncludingTax}
                    onChange={(event) => {
                      const including = event.target.value;
                      const rate = Number(newProduct.taxRate);
                      setNewProduct((value) => ({
                        ...value,
                        costIncludingTax: including,
                        costExcludingTax:
                          including === ""
                            ? ""
                            : String(Math.round(Number(including) / (1 + rate / 100))),
                      }));
                    }}
                  />
                </label>
                <label>
                  仕入原価（税抜）
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={newProduct.costExcludingTax}
                    onChange={(event) => {
                      const excluding = event.target.value;
                      const rate = Number(newProduct.taxRate);
                      setNewProduct((value) => ({
                        ...value,
                        costExcludingTax: excluding,
                        costIncludingTax:
                          excluding === ""
                            ? ""
                            : String(Math.round(Number(excluding) * (1 + rate / 100))),
                      }));
                    }}
                  />
                </label>
              </div>
              <div>
                <label>
                  税率
                  <select
                    value={newProduct.taxRate}
                    onChange={(event) =>
                      setNewProduct((value) => {
                        const rate = Number(event.target.value);
                        return {
                          ...value,
                          taxRate: event.target.value,
                          costIncludingTax:
                            value.costExcludingTax === ""
                              ? value.costIncludingTax
                              : String(
                                  Math.round(
                                    Number(value.costExcludingTax) * (1 + rate / 100),
                                  ),
                                ),
                        };
                      })
                    }
                  >
                    <option value="10">10%</option>
                    <option value="8">8%</option>
                  </select>
                </label>
                <label>
                  商品ジャンル（スマレジ）
                  <select
                    value={newProduct.category}
                    onChange={(event) =>
                      setNewProduct((value) => ({
                        ...value,
                        category: event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {busy === "SYNC"
                        ? "スマレジから取得中…"
                        : smaregiCategories.length
                          ? "選択してください"
                          : "部門を取得できませんでした"}
                    </option>
                    {smaregiCategories.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                disabled={
                  busy === "CREATE_PRODUCT"
                }
                onClick={() => void createProductForReceipt()}
              >
                {busy === "CREATE_PRODUCT"
                  ? "商品を登録中…"
                  : "商品マスタへ登録して入荷を続ける"}
              </button>
              {!newProduct.productCode && (
                <small>
                  バーコードがない商品は、重複しない商品コードを自動で発行します。
                </small>
              )}
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
            仕入れ先
            <input
              list="inventory-suppliers"
              value={form.supplierName}
              placeholder="過去の仕入れ先を検索、または新しく入力"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  supplierName: event.target.value,
                }))
              }
            />
            <datalist id="inventory-suppliers">
              {(data?.suppliers ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.name}>
                  最終利用 {new Date(supplier.lastUsedAt).toLocaleDateString("ja-JP")}
                </option>
              ))}
            </datalist>
            <small>使用日の新しい順に候補を表示します。初めての仕入れ先はそのまま入力できます。</small>
          </label>
          <label>
            税込仕入単価（1個あたり）
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.unitPrice}
              placeholder="例：198"
              onChange={(event) =>
                setForm((value) => ({ ...value, unitPrice: event.target.value }))
              }
            />
          </label>
          <label className="inventory-limited-price">
            <input
              type="checkbox"
              checked={form.isLimitedPrice}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  isLimitedPrice: event.target.checked,
                }))
              }
            />
            <span>
              <strong>期間限定価格・特売</strong>
              <small>通常価格ではない場合にチェックしてください</small>
            </span>
          </label>
          <label>
            消費・賞味期限
            <input
              type="date"
              value={form.expiryDate}
              disabled={form.noExpiry}
              onChange={(e) =>
                setForm((v) => ({ ...v, expiryDate: e.target.value }))
              }
            />
          </label>
          <label className="inventory-no-expiry">
            <input
              type="checkbox"
              checked={form.noExpiry}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  noExpiry: event.target.checked,
                  expiryDate: event.target.checked ? "" : value.expiryDate,
                }))
              }
            />
            <span>
              <strong>期限なし</strong>
              <small>消費・賞味期限を設定しない商品はこちら</small>
            </span>
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
              !form.supplierName.trim() ||
              Number(form.unitPrice) < 1 ||
              Boolean(busy)
            }
            onClick={() =>
              void (async () => {
                const saved = await post({
                action: "RECEIVE",
                productCode: selected?.code,
                productName: selected?.name,
                quantity: Number(form.quantity),
                expiryDate: form.noExpiry ? null : form.expiryDate,
                supplierName: form.supplierName,
                unitPrice: Number(form.unitPrice),
                isLimitedPrice: form.isLimitedPrice,
                note: form.note,
                });
                if (saved)
                  setForm((value) => ({
                    ...value,
                    productCode: "",
                    quantity: "1",
                    expiryDate: "",
                    noExpiry: false,
                    unitPrice: "",
                    isLimitedPrice: false,
                    note: "",
                  }));
              })()
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
