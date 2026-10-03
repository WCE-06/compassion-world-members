import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";

function admin(request: NextRequest) {
  const email = request.headers
      .get("oai-authenticated-user-email")
      ?.trim()
      .toLowerCase(),
    allowed = (
      (env as unknown as Record<string, string | undefined>).ADMIN_EMAILS ?? ""
    )
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  return email && allowed.includes(email) ? email : null;
}
function jstDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T00:00:00+09:00`)
    : NaN;
}
function stringValue(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim())
      return String(value);
  }
  return fallback;
}
function numberValue(row: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}
function arrayValue(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (Array.isArray(data[key])) return data[key] as unknown[];
  return [];
}

export async function GET(request: NextRequest) {
  if (!(admin(request) ?? (await requireAdminSession(request))))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const runtime = env as unknown as Record<string, string | undefined>,
    url = runtime.SMAREGI_SALES_SUMMARY_URL ?? runtime.SMAREGI_SPEND_RECALC_URL,
    key = runtime.SMAREGI_SALES_SUMMARY_KEY ?? runtime.SMAREGI_SPEND_SYNC_KEY;
  if (!url || !key)
    return NextResponse.json({ available: false, error: "NOT_CONFIGURED" });
  const requested =
      request.nextUrl.searchParams.get("date") ??
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    start = jstDay(requested);
  if (!Number.isFinite(start))
    return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
  const from = new Date(start).toISOString(),
    to = new Date(start + 86400000).toISOString(),
    dedicated = Boolean(
      runtime.SMAREGI_SALES_SUMMARY_URL && runtime.SMAREGI_SALES_SUMMARY_KEY,
    );
  try {
    const target = new URL(url);
    if (dedicated) {
      target.searchParams.set("from", from);
      target.searchParams.set("to", to);
      target.searchParams.set("scope", "ALL_STORES");
    }
    const response = await fetch(
      target,
      dedicated
        ? {
            headers: { Authorization: `Bearer ${key}`, "X-API-Key": key },
            signal: AbortSignal.timeout(20000),
          }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              op: "smaregiSalesSummary",
              syncKey: key,
              from,
              to,
              scope: "ALL_STORES",
            }),
            signal: AbortSignal.timeout(20000),
          },
    );
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const body = (await response.json()) as Record<string, unknown>;
    if (body.ok === false)
      throw new Error(String(body.error ?? "SALES_SUMMARY_FAILED"));
    const data = (
        body.result && typeof body.result === "object"
          ? body.result
          : body.data && typeof body.data === "object"
            ? body.data
            : body
      ) as Record<string, unknown>,
      rawStores = arrayValue(data, ["stores", "storeSales", "storeSummaries"]);
    const stores = rawStores
      .map((value) => {
        const row = value as Record<string, unknown>;
        return {
          storeId: stringValue(row, ["storeId", "storeCode", "id"]),
          name: stringValue(row, ["storeName", "name", "storeId"], "店舗"),
          amount: numberValue(row, ["amount", "sales", "total", "netSales"]),
          transactionCount: numberValue(row, ["transactionCount", "count"]),
          customerCount: numberValue(row, ["customerCount", "customers"]),
          returnAmount: numberValue(row, ["returnAmount", "returns"]),
        };
      })
      .filter((row) => Number.isFinite(row.amount));
    const rawTransactions = arrayValue(data, ["transactions", "receipts", "sales"]);
    const transactions = rawTransactions
      .map((value) => {
        const row = value as Record<string, unknown>;
        return {
          id: stringValue(row, ["id", "transactionId", "receiptId"]),
          receiptNo: stringValue(row, ["receiptNo", "receiptNumber", "receipt_no"]),
          storeId: stringValue(row, ["storeId", "storeCode"]),
          storeName: stringValue(row, ["storeName", "storeId"], "店舗"),
          amount: numberValue(row, ["amount", "total", "sales", "netSales"]),
          tax: numberValue(row, ["tax", "taxAmount"]),
          discount: numberValue(row, ["discount", "discountAmount"]),
          occurredAt: stringValue(row, ["occurredAt", "soldAt", "transactionAt", "createdAt"]),
          memberCode: stringValue(row, ["memberCode", "customerCode"]),
          paymentMethod: stringValue(row, ["paymentMethod", "payment", "paymentName"]),
          staffName: stringValue(row, ["staffName", "staff"]),
          division: stringValue(row, ["division", "transactionDivision"], "SALE"),
        };
      })
      .filter((row) => row.id && Number.isFinite(row.amount));
    const productRows = arrayValue(data, ["products", "items", "productSales"]).map(
      (value) => {
        const row = value as Record<string, unknown>;
        return {
          productId: stringValue(row, ["productId", "id", "code"]),
          name: stringValue(row, ["name", "productName"], "商品"),
          quantity: numberValue(row, ["quantity", "qty", "count"]),
          amount: numberValue(row, ["amount", "sales", "total"]),
        };
      },
    ).filter((row) => row.productId || row.name !== "商品");
    const paymentRows = arrayValue(data, ["payments", "paymentMethods", "paymentSummary"]).map(
      (value) => {
        const row = value as Record<string, unknown>;
        return {
          method: stringValue(row, ["method", "paymentMethod", "name"], "未分類"),
          amount: numberValue(row, ["amount", "sales", "total"]),
          transactionCount: numberValue(row, ["transactionCount", "count"]),
        };
      },
    ).filter((row) => Number.isFinite(row.amount));
    const hourlyRows = arrayValue(data, ["hourly", "hourlySales", "timeBands"]).map(
      (value) => {
        const row = value as Record<string, unknown>;
        return {
          hour: stringValue(row, ["hour", "label", "time"], "時間帯"),
          amount: numberValue(row, ["amount", "sales", "total"]),
          transactionCount: numberValue(row, ["transactionCount", "count"]),
        };
      },
    ).filter((row) => Number.isFinite(row.amount));
    const amount = Number(
      data.amount ??
        data.sales ??
        data.totalSales ??
        data.total ??
        stores.reduce((sum, row) => sum + row.amount, 0),
    );
    return NextResponse.json(
      {
        available: Number.isFinite(amount),
        date: requested,
        amount: Number.isFinite(amount) ? amount : 0,
        stores,
        transactions,
        products: productRows,
        payments: paymentRows,
        hourly: hourlyRows,
        transactionCount: Number(data.transactionCount ?? transactions.length ?? 0),
        customerCount: Number(data.customerCount ?? stores.reduce((sum, row) => sum + (row.customerCount || 0), 0)),
        returnAmount: Number(data.returnAmount ?? stores.reduce((sum, row) => sum + (row.returnAmount || 0), 0)),
        discountAmount: Number(data.discountAmount ?? transactions.reduce((sum, row) => sum + (row.discount || 0), 0)),
        taxAmount: Number(data.taxAmount ?? transactions.reduce((sum, row) => sum + (row.tax || 0), 0)),
        syncedAt: String(data.syncedAt ?? new Date().toISOString()),
      },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (error) {
    console.error("smaregi sales summary failed", error);
    return NextResponse.json(
      { available: false, date: requested, error: "SALES_SUMMARY_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
