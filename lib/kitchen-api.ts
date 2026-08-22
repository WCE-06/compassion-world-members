import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";

async function digest(value:string){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));}

export async function requireKitchenToken(request:NextRequest){
  const configured=(env as unknown as {KITCHEN_API_TOKEN?:string}).KITCHEN_API_TOKEN??"";
  const authorization=request.headers.get("authorization")??"";
  const supplied=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  if(!configured||!supplied)return false;
  const [expected,actual]=await Promise.all([digest(configured),digest(supplied)]);
  if(expected.length!==actual.length)return false;
  let difference=0;for(let index=0;index<expected.length;index+=1)difference|=expected[index]^actual[index];
  return difference===0;
}
