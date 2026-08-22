import { env } from "cloudflare:workers";

function runtime(){return env as unknown as Record<string,string|undefined>}

export function stripeConfigured(){const value=runtime();return Boolean(value.STRIPE_SECRET_KEY&&value.STRIPE_WEBHOOK_SECRET&&value.SMART_PAYMENT_ENABLED==="true")}

export async function stripeRequest<T>(path:string,method:"GET"|"POST"="GET",body?:URLSearchParams):Promise<T>{
 const key=runtime().STRIPE_SECRET_KEY;if(!key)throw new Error("STRIPE_NOT_CONFIGURED");
 const response=await fetch(`https://api.stripe.com/v1${path}`,{method,headers:{Authorization:`Bearer ${key}`,...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{})},body,cache:"no-store"});
 const result=await response.json() as T&{error?:{message?:string}};if(!response.ok)throw new Error(result.error?.message??`STRIPE_API_${response.status}`);return result;
}

function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,"0")).join("")}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let result=0;for(let index=0;index<a.length;index++)result|=a.charCodeAt(index)^b.charCodeAt(index);return result===0}

export async function verifyStripeWebhook(payload:string,signatureHeader:string|null){
 const secret=runtime().STRIPE_WEBHOOK_SECRET;if(!secret||!signatureHeader)return false;
 const entries=signatureHeader.split(",").map(part=>part.split("=",2));const timestamp=entries.find(([key])=>key==="t")?.[1];const signatures=entries.filter(([key])=>key==="v1").map(([,value])=>value);
 if(!timestamp||!signatures.length||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const digest=hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${timestamp}.${payload}`)));
 return signatures.some(signature=>safeEqual(signature,digest));
}
