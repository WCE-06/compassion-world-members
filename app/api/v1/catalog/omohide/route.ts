import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

type PublishedProduct = {
  productCode: string;
  productName: string;
  displaySequence: number;
};

/**
 * おもひで商店の「バーコードがない商品」専用公開一覧。
 *
 * 商品名・価格・税率はセルフレジの商品カタログを正本とし、このAPIは
 * 管理画面で明示された商品コードと表示順だけを返す。
 */
export async function GET() {
  const result = await env.DB.prepare(`
    SELECT
      p.product_code AS productCode,
      p.product_name AS productName,
      c.omohide_sequence AS displaySequence
    FROM catalog_overrides c
    JOIN inventory_product_settings p ON p.product_code = c.product_code
    LEFT JOIN product_master_deletions d ON d.product_code = p.product_code
    WHERE c.omohide_display = 1
      AND d.product_code IS NULL
      AND p.display_flag = 1
    ORDER BY COALESCE(c.omohide_sequence, 999999999), p.product_name
    LIMIT 1000
  `).all<PublishedProduct>();

  return NextResponse.json(
    {
      ok: true,
      products: result.results.map((product) => ({
        productCode: String(product.productCode),
        name: String(product.productName),
        displaySequence: Number(product.displaySequence ?? 999999999),
      })),
      updatedAt: Date.now(),
    },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } },
  );
}
