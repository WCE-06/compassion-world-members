import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";

export const verificationSystems=["SELF_REGISTER","ENTRANCE","STUDIO_RECEPTION","RESERVATION","MOBILE_ORDER"] as const;
export type VerificationSystem=typeof verificationSystems[number];

const tokenKeys:Record<VerificationSystem,string>={SELF_REGISTER:"MEMBER_VERIFICATION_SELF_REGISTER_TOKEN",ENTRANCE:"MEMBER_VERIFICATION_ENTRANCE_TOKEN",STUDIO_RECEPTION:"MEMBER_VERIFICATION_STUDIO_RECEPTION_TOKEN",RESERVATION:"MEMBER_VERIFICATION_RESERVATION_TOKEN",MOBILE_ORDER:"MEMBER_VERIFICATION_MOBILE_ORDER_TOKEN"};

export async function sha256(value:string){const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));return [...bytes].map(byte=>byte.toString(16).padStart(2,"0")).join("")}

export async function authorizedVerificationSystem(request:NextRequest,system:VerificationSystem){const runtime=env as unknown as Record<string,string|undefined>,expected=runtime[tokenKeys[system]]?.trim()??"",authorization=request.headers.get("authorization")??"",supplied=authorization.startsWith("Bearer ")?authorization.slice(7).trim():"";if(!expected||!supplied)return false;const [actualHash,expectedHash]=await Promise.all([sha256(supplied),sha256(expected)]);let difference=0;for(let index=0;index<expectedHash.length;index++)difference|=expectedHash.charCodeAt(index)^actualHash.charCodeAt(index);return difference===0}

export function validVerificationSystem(value:string):value is VerificationSystem{return verificationSystems.includes(value as VerificationSystem)}
