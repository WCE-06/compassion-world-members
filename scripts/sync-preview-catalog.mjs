import { mkdir, readFile, writeFile } from "node:fs/promises";

const endpoint = process.env.SELF_REGISTER_CATALOG_URL ??
  "https://script.google.com/macros/s/AKfycbx-NlcSg-7MoAKRdySnfs05LY2Ttd3RVYEjWjcDx0MfLTE49EYazxUrV8e2CD-dAB8P/exec?api=catalog";

const snapshotUrl = new URL("../preview/generated/catalog.json", import.meta.url);
function inferMocktailPair(name, menuCategory) {
  if (menuCategory !== "soft-mocktail") return { base: "", mixer: "" };
  const value = String(name).replace(/[\s・]/g, "");
  const bases = [[/カシスストロベリー/,"カシスストロベリー"],[/ピーチストロベリー/,"ピーチストロベリー"],[/カシス/,"カシス"],[/ストロベリー/,"ストロベリー"],[/ピーチ|ファジーネーブル|レゲエパンチ/,"ピーチ"],[/梅酒風/,"梅酒風"]];
  const mixers = [[/ウーロン/,"ウーロン茶"],[/グリーンティー|緑茶/,"緑茶"],[/オレンジ/,"オレンジ"],[/カルピス/,"カルピス"],[/コーラ|コーク/,"コーラ"],[/ソーダ/,"ソーダ"],[/ミルク/,"ミルク"],[/ラムネ/,"ラムネ"],[/水割り/,"水"],[/ロック/,"ロック／ストレート"]];
  return { base:bases.find(([pattern])=>pattern.test(value))?.[1]??"", mixer:mixers.find(([pattern])=>pattern.test(value))?.[1]??"" };
}
function enrichSavedProducts(products) {
  return products.map(product => { const inferred=inferMocktailPair(product.name,product.menuCategory); return {
    ...product,
    cocktailBase:product.cocktailBase||inferred.base,
    cocktailMixer:product.cocktailMixer||inferred.mixer,
  }; });
}
if (process.env.PREVIEW_CATALOG_SNAPSHOT_ONLY === "1") {
  const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
  snapshot.products = enrichSavedProducts(snapshot.products);
  await writeFile(snapshotUrl, JSON.stringify(snapshot, null, 2));
  console.log(`Enriched ${snapshot.products.length} saved products`);
  process.exit(0);
}
let body;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}sync=${Date.now()}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error(`Catalog fetch failed: ${response.status}`);
    body = await response.json();
    if (!body?.ok || !Array.isArray(body?.result?.products)) throw new Error("Catalog response is invalid");
    break;
  } catch (error) {
    if (attempt === 3) {
      const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
      snapshot.products = enrichSavedProducts(snapshot.products);
      await writeFile(snapshotUrl, JSON.stringify(snapshot, null, 2));
      console.warn(`Live catalog unavailable; using ${snapshot.products.length} saved products`);
      process.exit(0);
    }
    console.warn(`Catalog attempt ${attempt} failed; retrying`);
  }
}

const products = body.result.products
  .filter(product => product.section === "kitchen" && product.code && product.name && product.menuCategory)
  .map(product => { const inferred=inferMocktailPair(product.name,product.menuCategory); return ({
    id: `smaregi:${product.code}`,
    code: String(product.code),
    name: String(product.name),
    category: String(product.menuCategory).startsWith("food-") ? "FOOD" : "DRINK",
    menuCategory: String(product.menuCategory),
    description: String(product.description ?? ""),
    price: Number(product.price),
    imageUrl: String(product.imageUrl ?? ""),
    soldOut: Boolean(product.soldOut),
    cocktailBase: String(product.cocktailBase || inferred.base),
    cocktailMixer: String(product.cocktailMixer || inferred.mixer),
    displaySequence: Number(product.displaySequence ?? 999999999),
    showOnSelfRegister: true,
    showOnMobileOrder: true,
    hasOverride: false,
  });})
  .filter(product => Number.isFinite(product.price) && product.price >= 0)
  .sort((a, b) => a.displaySequence - b.displaySequence || a.name.localeCompare(b.name, "ja"));

if (!products.length) throw new Error("Current self-register kitchen catalog is empty");
await mkdir(new URL("../preview/generated/", import.meta.url), { recursive: true });
await writeFile(snapshotUrl, JSON.stringify({
  products,
  sync: body.result.sync ?? {},
}, null, 2));
console.log(`Synced ${products.length} current self-register products for preview`);
