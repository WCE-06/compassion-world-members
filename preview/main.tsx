import React from "react";
import { createRoot } from "react-dom/client";
import MobileOrderPage from "../app/mobile-order/page";
import MenuAdminPage from "../app/menu-admin/page";
import "../app/globals.css";
import currentCatalog from "./generated/catalog.json";

const products = currentCatalog.products;
const previewRevision = import.meta.env.VITE_PREVIEW_REVISION || "local";
const previewAdminKey = "compassion-world-admin-preview-v1";
const defaultPreviewAdmin = {
  hours:{enabled:true,lunchEnabled:true,lunchStart:"11:30",lunchEnd:"14:00",lunchLastOrder:"13:30",lunchDays:[2,3,4,5,6,7],dinnerEnabled:true,dinnerStart:"17:30",dinnerEnd:"22:00",dinnerLastOrder:"21:30",dinnerDays:[6],eventDinnerEnabled:true},
  exceptions:[] as Record<string,unknown>[],
};
let previewAdminState=defaultPreviewAdmin;
try{const saved=localStorage.getItem(previewAdminKey);if(saved)previewAdminState={...defaultPreviewAdmin,...JSON.parse(saved)}}catch{previewAdminState=defaultPreviewAdmin}
const persistPreviewAdmin=()=>localStorage.setItem(previewAdminKey,JSON.stringify(previewAdminState));

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
  if (url.endsWith("/api/v1/admin/store-hours") && init?.method === "PUT") {const body=JSON.parse(String(init.body??"{}"));if(body.kind==="EXCEPTION"){const exception={...body};delete exception.kind;previewAdminState={...previewAdminState,exceptions:[...previewAdminState.exceptions.filter(item=>item.date!==exception.date),exception]}}else{previewAdminState={...previewAdminState,hours:body}}persistPreviewAdmin();return new Response(JSON.stringify({saved:true}), {status:200,headers:{"Content-Type":"application/json"}})}
  if (url.endsWith("/api/v1/admin/store-hours")) return new Response(JSON.stringify(previewAdminState), {status:200,headers:{"Content-Type":"application/json"}});
  if (url.endsWith("/api/v1/admin/category-schedules") && init?.method === "PUT") return new Response(JSON.stringify({saved:true}), {status:200,headers:{"Content-Type":"application/json"}});
  if (url.endsWith("/api/v1/admin/category-schedules")) return new Response(JSON.stringify({schedules:[{category:"food-don",enabled:true,startTime:"11:30",endTime:"14:00",days:[6,7],note:"お米使用メニューは土日限定"}]}), {status:200,headers:{"Content-Type":"application/json"}});
  if (url.endsWith("/api/v1/admin/catalog")) return new Response(JSON.stringify({ products, sync:currentCatalog.sync }), { status:200, headers:{"Content-Type":"application/json"} });
  if (url.endsWith("/api/v1/orders") && init?.method === "POST") return new Response(JSON.stringify({ orderNumber:"PREVIEW-001",fulfillments:[{department:"FOOD",label:"フード",callNumber:12,status:"ACCEPTED"},{department:"DRINK",label:"ドリンク",callNumber:7,status:"ACCEPTED"}],status:"WAITING_STORE_PAYMENT",paymentMethod:"STORE",paymentLabel:"現地決済",pointEligible:true,pointStatus:"PENDING",totalIncludingTax:980,expiresAt:Date.now()+900000 }), { status:200, headers:{"Content-Type":"application/json"} });
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<React.StrictMode>{new URLSearchParams(location.search).get("view")==="admin"?<MenuAdminPage/>:<MobileOrderPage/>}</React.StrictMode>);
