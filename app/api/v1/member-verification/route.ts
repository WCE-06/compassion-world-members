import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { authorizedVerificationSystem,sha256,validVerificationSystem,type VerificationSystem } from "@/lib/member-verification";

type Body={memberCode?:unknown;system?:unknown;deviceId?:unknown;requestId?:unknown};
type VerificationResult="ACTIVE"|"SUSPENDED"|"WITHDRAWN"|"UNREGISTERED";
type AuditRow={requestFingerprint:string;tokenScope:string;httpStatus:number;responseJson:string};
type MemberRow={id:string;memberCode:string;displayName:string;status:string;verificationStatus:string|null};

const noStore={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const response=(body:Record<string,unknown>,status=200,extra:Record<string,string>={})=>NextResponse.json(body,{status,headers:{...noStore,...extra}});
const validRequestId=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validDeviceId=(value:string)=>/^[A-Z0-9][A-Z0-9._:-]{2,79}$/.test(value);

async function replay(requestId:string,fingerprint:string,scope:string){const row=await env.DB.prepare("SELECT request_fingerprint AS requestFingerprint,token_scope AS tokenScope,http_status AS httpStatus,response_json AS responseJson FROM member_verification_audits WHERE request_id=? LIMIT 1").bind(requestId).first<AuditRow>();if(!row)return null;if(row.requestFingerprint!==fingerprint||row.tokenScope!==scope)return response({ok:false,error:"REQUEST_ID_CONFLICT",message:"同じrequestIdが異なる照会内容で使用されています"},409);return response(JSON.parse(row.responseJson),row.httpStatus,{"X-Idempotent-Replay":"true"})}

async function saveAudit(values:{requestId:string;fingerprint:string;system:VerificationSystem;deviceId:string;scope:string;memberCodeHash:string;result:VerificationResult;httpStatus:number;durationMs:number;body:Record<string,unknown>}){await env.DB.prepare("INSERT INTO member_verification_audits(request_id,request_fingerprint,system,device_id,token_scope,member_code_hash,result,http_status,duration_ms,response_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(values.requestId,values.fingerprint,values.system,values.deviceId,values.scope,values.memberCodeHash,values.result,values.httpStatus,values.durationMs,JSON.stringify(values.body),Date.now()).run()}

export async function POST(request:NextRequest){const started=performance.now(),raw=await request.json().catch(()=>null) as Body|null,memberCode=typeof raw?.memberCode==="string"?raw.memberCode:"",system=typeof raw?.system==="string"?raw.system:"",deviceId=typeof raw?.deviceId==="string"?raw.deviceId:"",requestId=typeof raw?.requestId==="string"?raw.requestId:"";
 if(!/^[A-Z0-9]{10}$/.test(memberCode)||!validVerificationSystem(system)||!validDeviceId(deviceId)||!validRequestId(requestId))return response({ok:false,error:"INVALID_REQUEST",message:"memberCode、system、deviceId、requestIdを確認してください"},400);
 if(!await authorizedVerificationSystem(request,system))return response({ok:false,error:"UNAUTHORIZED",message:"端末認証に失敗しました"},401);
 const scope=system,fingerprint=await sha256(JSON.stringify({memberCode,system,deviceId})),memberCodeHash=await sha256(memberCode);
 try{const existing=await replay(requestId,fingerprint,scope);if(existing)return existing;const member=await env.DB.prepare("SELECT id,member_code AS memberCode,display_name AS displayName,status,verification_status AS verificationStatus FROM members WHERE member_code=? LIMIT 1").bind(memberCode).first<MemberRow>(),result:VerificationResult=!member?"UNREGISTERED":member.verificationStatus==="WITHDRAWN"?"WITHDRAWN":member.status!=="ACTIVE"||member.verificationStatus==="SUSPENDED"?"SUSPENDED":"ACTIVE",verified=result==="ACTIVE",body={ok:true,verified,result,member:member?{memberId:member.id,memberCode:member.memberCode,displayName:member.displayName,status:result}:null,requestId,system,deviceId,checkedAt:new Date().toISOString()},durationMs=Math.max(0,Math.round(performance.now()-started));
  try{await saveAudit({requestId,fingerprint,system,deviceId,scope,memberCodeHash,result,httpStatus:200,durationMs,body})}catch{const concurrent=await replay(requestId,fingerprint,scope);if(concurrent)return concurrent;throw new Error("AUDIT_WRITE_FAILED")}
  return response(body,200,{"Server-Timing":`verification;dur=${durationMs}`});
 }catch(error){console.error("member verification failed",error instanceof Error?error.message:"UNKNOWN");return response({ok:false,error:"VERIFICATION_SERVICE_UNAVAILABLE",message:"会員認証サービスへ接続できません",requestId,retryable:true},503,{"Retry-After":"1"})}}
