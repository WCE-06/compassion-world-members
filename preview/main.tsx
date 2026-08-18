import React from "react";
import { createRoot } from "react-dom/client";
import MobileOrderPage from "../app/mobile-order/page";
import MenuAdminPage from "../app/menu-admin/page";
import "../app/globals.css";

const products = [
  { id:"preview:tsukemen",code:"AK001",name:"濃厚魚介つけ麺",category:"FOOD",menuCategory:"food-tsukemen",description:"魚介の旨みを楽しむ濃厚つけ麺",price:980,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
  { id:"preview:udon",code:"AK002",name:"甲州ほうとう",category:"FOOD",menuCategory:"food-udon",description:"野菜たっぷりの温かいほうとう",price:1100,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
  { id:"preview:pasta",code:"AK003",name:"昔ながらのナポリタン",category:"FOOD",menuCategory:"food-pasta",description:"喫茶店仕立ての定番パスタ",price:850,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
  { id:"preview:don",code:"AK004",name:"相盛りからあげ丼",category:"FOOD",menuCategory:"food-don",description:"二種類のからあげを一度に",price:780,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
  { id:"preview:side",code:"AK005",name:"フライドポテト",category:"FOOD",menuCategory:"food-side",description:"シェアにもおすすめ",price:420,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
  { id:"preview:coffee",code:"AK101",name:"ブレンドコーヒー",category:"DRINK",menuCategory:"soft-cafe",description:"香り豊かな定番コーヒー",price:350,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
  { id:"preview:cola",code:"AK102",name:"ペプシコーラ",category:"DRINK",menuCategory:"soft-simple",description:"",price:250,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
  { id:"preview:mocktail",code:"AK103",name:"青空モクテル",category:"DRINK",menuCategory:"soft-mocktail",description:"ノンアルコールカクテル",price:480,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
  { id:"preview:beer",code:"AK201",name:"生ビール",category:"DRINK",menuCategory:"alcohol-main",description:"",price:550,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
  { id:"preview:umeshu-soda",code:"AK202",name:"梅酒ソーダ",category:"DRINK",menuCategory:"alcohol-cocktail",description:"",price:520,imageUrl:"",soldOut:false,cocktailBase:"梅酒",cocktailMixer:"ソーダ" },
  { id:"preview:umeshu-water",code:"AK203",name:"梅酒の水割り",category:"DRINK",menuCategory:"alcohol-cocktail",description:"",price:500,imageUrl:"",soldOut:false,cocktailBase:"梅酒",cocktailMixer:"水" },
  { id:"preview:whisky-soda",code:"AK204",name:"ハイボール",category:"DRINK",menuCategory:"alcohol-cocktail",description:"",price:500,imageUrl:"",soldOut:false,cocktailBase:"ウイスキー",cocktailMixer:"ソーダ" },
  { id:"preview:dessert",code:"AK301",name:"コーヒーゼリー",category:"DRINK",menuCategory:"dessert",description:"ほろ苦い大人のデザート",price:450,imageUrl:"",soldOut:false,cocktailBase:"",cocktailMixer:"" },
];

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.endsWith("/api/v1/catalog")) return new Response(JSON.stringify({ products }), { status:200, headers:{"Content-Type":"application/json"} });
  if (url.endsWith("/api/v1/admin/catalog") && init?.method === "PUT") return new Response(JSON.stringify({saved:true}), {status:200,headers:{"Content-Type":"application/json"}});
  if (url.endsWith("/api/v1/admin/catalog")) return new Response(JSON.stringify({ products:products.map((p,index)=>({...p,displaySequence:(index+1)*10,showOnSelfRegister:true,showOnMobileOrder:true,hasOverride:index<3})) }), { status:200, headers:{"Content-Type":"application/json"} });
  if (url.endsWith("/api/v1/orders") && init?.method === "POST") return new Response(JSON.stringify({ orderNumber:"PREVIEW-001",status:"WAITING_STORE_PAYMENT",totalIncludingTax:980,expiresAt:Date.now()+900000 }), { status:200, headers:{"Content-Type":"application/json"} });
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<React.StrictMode>{new URLSearchParams(location.search).get("view")==="admin"?<MenuAdminPage/>:<MobileOrderPage/>}</React.StrictMode>);
