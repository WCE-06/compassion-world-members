import { env } from "cloudflare:workers";

export type OrderProduct={id:string;code:string;name:string;category:"FOOD"|"DRINK";menuCategory:string;description:string;price:number;imageUrl:string;soldOut:boolean;optionGroups:unknown[]};
type SourceProduct={code:string;name:string;price:number;section:string;menuCategory:string;description?:string;imageUrl?:string;soldOut?:boolean;optionGroups?:unknown[];displaySequence?:number};
type CatalogResponse={ok:boolean;result?:{products?:SourceProduct[];sync?:{state?:string;completedAt?:string;storedCount?:number}}};

export async function getOrderProducts(){
 const runtime=env as unknown as Record<string,string|undefined>;const url=runtime.SELF_REGISTER_CATALOG_URL;
 if(!url)throw new Error("CATALOG_URL_NOT_CONFIGURED");
 const response=await fetch(url,{redirect:"follow",cache:"no-store"});if(!response.ok)throw new Error("CATALOG_UNAVAILABLE");
 const body=await response.json() as CatalogResponse;if(!body.ok||!body.result)throw new Error("CATALOG_INVALID_RESPONSE");
 const products=(body.result.products??[]).filter(product=>product.section==="kitchen"&&Boolean(product.menuCategory)).map(product=>({id:`smaregi:${product.code}`,code:product.code,name:product.name,category:product.menuCategory.startsWith("food-")?"FOOD" as const:"DRINK" as const,menuCategory:product.menuCategory,description:product.description??"",price:Number(product.price),imageUrl:product.imageUrl??"",soldOut:Boolean(product.soldOut),optionGroups:product.optionGroups??[],displaySequence:Number(product.displaySequence??999999999)})).filter(product=>Number.isFinite(product.price)&&product.price>=0).sort((a,b)=>a.displaySequence-b.displaySequence||a.name.localeCompare(b.name,"ja"));
 return{products:products.map(({displaySequence,...product})=>product),sync:body.result.sync??{}};
}
