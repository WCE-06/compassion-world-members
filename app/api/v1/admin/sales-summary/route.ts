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
      rawStores = Array.isArray(data.stores) ? data.stores : [];
    const stores = rawStores
      .map((value) => {
        const row = value as Record<string, unknown>;
        return {
          storeId: String(row.storeId ?? ""),
          name: String(row.storeName ?? row.name ?? row.storeId ?? "店舗"),
          amount: Number(row.amount ?? row.sales ?? row.total ?? 0),
          transactionCount: Number(row.transactionCount ?? 0),
        };
      })
      .filter((row) => Number.isFinite(row.amount));
    const rawTransactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];
    const transactions = rawTransactions
      .map((value) => {
        const row = value as Record<string, unknown>;
        return {
          id: String(row.id ?? ""),
          receiptNo: String(row.receiptNo ?? ""),
          storeId: String(row.storeId ?? ""),
          storeName: String(row.storeName ?? row.storeId ?? "店舗"),
          amount: Number(row.amount ?? 0),
          occurredAt: String(row.occurredAt ?? ""),
          memberCode: String(row.memberCode ?? ""),
          division: String(row.division ?? "SALE"),
        };
      })
      .filter((row) => row.id && Number.isFinite(row.amount));
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
        transactionCount: Number(data.transactionCount ?? 0),
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
