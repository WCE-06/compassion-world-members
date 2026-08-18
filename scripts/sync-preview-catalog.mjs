import { mkdir, writeFile } from "node:fs/promises";

const endpoint = process.env.SELF_REGISTER_CATALOG_URL ??
  "https://script.google.com/macros/s/AKfycbx-NlcSg-7MoAKRdySnfs05LY2Ttd3RVYEjWjcDx0MfLTE49EYazxUrV8e2CD-dAB8P/exec?api=catalog";

const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}sync=${Date.now()}`, {
  redirect: "follow",
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`Catalog fetch failed: ${response.status}`);
const body = await response.json();
if (!body?.ok || !Array.isArray(body?.result?.products)) throw new Error("Catalog response is invalid");

const products = body.result.products
  .filter(product => product.section === "kitchen" && product.code && product.name && product.menuCategory)
  .map(product => ({
    id: `smaregi:${product.code}`,
    code: String(product.code),
    name: String(product.name),
    category: String(product.menuCategory).startsWith("food-") ? "FOOD" : "DRINK",
    menuCategory: String(product.menuCategory),
    description: String(product.description ?? ""),
    price: Number(product.price),
    imageUrl: String(product.imageUrl ?? ""),
    soldOut: Boolean(product.soldOut),
    cocktailBase: String(product.cocktailBase ?? ""),
    cocktailMixer: String(product.cocktailMixer ?? ""),
    displaySequence: Number(product.displaySequence ?? 999999999),
    showOnSelfRegister: true,
    showOnMobileOrder: true,
    hasOverride: false,
  }))
  .filter(product => Number.isFinite(product.price) && product.price >= 0)
  .sort((a, b) => a.displaySequence - b.displaySequence || a.name.localeCompare(b.name, "ja"));

if (!products.length) throw new Error("Current self-register kitchen catalog is empty");
await mkdir(new URL("../preview/generated/", import.meta.url), { recursive: true });
await writeFile(new URL("../preview/generated/catalog.json", import.meta.url), JSON.stringify({
  products,
  sync: body.result.sync ?? {},
}, null, 2));
console.log(`Synced ${products.length} current self-register products for preview`);
