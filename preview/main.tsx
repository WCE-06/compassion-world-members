import React from "react";
import { createRoot } from "react-dom/client";
import MobileOrderPage from "../app/mobile-order/page";
import MenuAdminPage from "../app/menu-admin/page";
import "../app/globals.css";
import currentCatalog from "./generated/catalog.json";

const products = currentCatalog.products;
const previewRevision = import.meta.env.VITE_PREVIEW_REVISION || "local";

// Keep the visible URL tied to the exact preview build so copied links do not
// silently reopen an older cached document after a later deployment.
if (previewRevision !== "local") {
  const previewUrl = new URL(window.location.href);
  const requestedRevision = previewUrl.searchParams.get("revision");
  if (!requestedRevision || !previewRevision.startsWith(requestedRevision)) {
    previewUrl.searchParams.set("revision", previewRevision.slice(0, 7));
    previewUrl.searchParams.set("cache", Date.now().toString());
    history.replaceState(null, "", previewUrl);
  }
  document.documentElement.dataset.previewRevision = previewRevision;
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.endsWith("/api/v1/catalog")) return new Response(JSON.stringify({ products }), { status:200, headers:{"Content-Type":"application/json"} });
  if (url.endsWith("/api/v1/admin/catalog") && init?.method === "PUT") return new Response(JSON.stringify({saved:true}), {status:200,headers:{"Content-Type":"application/json"}});
  if (url.endsWith("/api/v1/admin/catalog")) return new Response(JSON.stringify({ products, sync:currentCatalog.sync }), { status:200, headers:{"Content-Type":"application/json"} });
  if (url.endsWith("/api/v1/orders") && init?.method === "POST") return new Response(JSON.stringify({ orderNumber:"PREVIEW-001",status:"WAITING_STORE_PAYMENT",totalIncludingTax:980,expiresAt:Date.now()+900000 }), { status:200, headers:{"Content-Type":"application/json"} });
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<React.StrictMode>{new URLSearchParams(location.search).get("view")==="admin"?<MenuAdminPage/>:<MobileOrderPage/>}</React.StrictMode>);
