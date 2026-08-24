import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";

const COOKIE_NAME="cw_admin_session",MAX_AGE=60*60*8;
const encoder=new TextEncoder();
const settings=()=>env as unknown as Record<string,string|undefined>;
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const decode=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=")),character=>character.charCodeAt(0));
const equal=(left:Uint8Array,right:Uint8Array)=>{if(left.length!==right.length)return false;let difference=0;for(let index=0;index<left.length;index++)difference|=left[index]^right[index];return difference===0};
const allowedEmail=(email:string)=>settings().ADMIN_EMAILS?.split(",").map(value=>value.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase())??false;
async function signature(value:string){const key=await crypto.subtle.importKey("raw",encoder.encode(settings().ADMIN_SESSION_SECRET??""),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(value)))}
export async function verifyAdminPassword(email:string,password:string){if(!allowedEmail(email)||!password)return false;const [scheme,iterationsText,saltText,hashText]=(settings().ADMIN_PASSWORD_HASH??"").split("$"),iterations=Number(iterationsText);if(scheme!=="pbkdf2_sha256"||!Number.isInteger(iterations)||iterations<100000||!saltText||!hashText)return false;try{const material=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]),result=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:decode(saltText),iterations},material,256));return equal(result,decode(hashText))}catch{return false}}
export async function createAdminSession(email:string){const payload=encode(encoder.encode(JSON.stringify({email:email.trim().toLowerCase(),exp:Date.now()+MAX_AGE*1000})));return `${payload}.${encode(await signature(payload))}`}
export async function requireAdminSession(request:NextRequest){const token=request.cookies.get(COOKIE_NAME)?.value;if(!token)return null;const [payload,provided]=token.split(".");if(!payload||!provided)return null;try{if(!equal(await signature(payload),decode(provided)))return null;const parsed=JSON.parse(new TextDecoder().decode(decode(payload))) as {email?:string;exp?:number};return parsed.email&&allowedEmail(parsed.email)&&Number(parsed.exp)>Date.now()?parsed.email:null}catch{return null}}
export const adminCookie={name:COOKIE_NAME,maxAge:MAX_AGE,options:{httpOnly:true,secure:true,sameSite:"strict" as const,path:"/"}};
