import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { catalogOverrides } from "@/db/schema";

export type OrderProduct={id:string;code:string;name:string;category:"FOOD"|"DRINK";menuCategory:string;description:string;price:number;imageUrl:string;soldOut:boolean;optionGroups:unknown[];cocktailBase:string;cocktailMixer:string};
type SourceProduct={code:string;name:string;price:number;section:string;menuCategory:string;description?:string;imageUrl?:string;soldOut?:boolean;optionGroups?:unknown[];displaySequence?:number;cocktailBase?:string;cocktailMixer?:string};
type CatalogResponse={ok:boolean;result?:{products?:SourceProduct[];sync?:{state?:string;completedAt?:string;storedCount?:number}}};

export async function getOrderProducts(options:{includeOverrides?:boolean;channel?:"MOBILE_ORDER"|"SELF_REGISTER"}={}){
 const runtime=env as unknown as Record<string,string|undefined>;const url=runtime.SELF_REGISTER_CATALOG_URL;
 if(!url)throw new Error("CATALOG_URL_NOT_CONFIGURED");
 const response=await fetch(url,{redirect:"follow",cache:"no-store"});if(!response.ok)throw new Error("CATALOG_UNAVAILABLE");
 const body=await response.json() as CatalogResponse;if(!body.ok||!body.result)throw new Error("CATALOG_INVALID_RESPONSE");
 let overrides:Record<string,typeof catalogOverrides.$inferSelect>={};
 try{overrides=Object.fromEntries((await getDb().select().from(catalogOverrides)).map(row=>[row.productCode,row]));}catch{overrides={};}
 const products=(body.result.products??[]).filter(product=>product.section==="kitchen"&&Boolean(product.menuCategory)).map(product=>{const override=overrides[product.code];return{id:`smaregi:${product.code}`,code:product.code,name:product.name,category:(override?.menuCategory??product.menuCategory).startsWith("food-")?"FOOD" as const:"DRINK" as const,menuCategory:override?.menuCategory??product.menuCategory,description:override?.description||product.description||"",price:Number(product.price),imageUrl:override?.imageUrl||product.imageUrl||"",soldOut:override?.soldOut??Boolean(product.soldOut),optionGroups:product.optionGroups??[],cocktailBase:product.cocktailBase??"",cocktailMixer:product.cocktailMixer??"",displaySequence:override?.displaySequence??Number(product.displaySequence??999999999),showOnSelfRegister:override?.showOnSelfRegister??true,showOnMobileOrder:override?.showOnMobileOrder??true,hasOverride:Boolean(override)}}).filter(product=>Number.isFinite(product.price)&&product.price>=0).sort((a,b)=>a.displaySequence-b.displaySequence||a.name.localeCompare(b.name,"ja"));
 const visible=options.includeOverrides?products:products.filter(product=>options.channel==="SELF_REGISTER"?product.showOnSelfRegister:product.showOnMobileOrder);
 return{products:visible.map(product=>options.includeOverrides?product:((({displaySequence,showOnSelfRegister,showOnMobileOrder,hasOverride,...publicProduct})=>publicProduct)(product))),sync:body.result.sync??{}};
}
