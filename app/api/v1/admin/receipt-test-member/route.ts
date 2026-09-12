import {env} from "cloudflare:workers";
import {NextRequest} from "next/server";
import {requireAdminPermission} from "@/lib/admin-session";
import {receiptError,receiptResponse} from "@/lib/receipt-api";
const TEST_CODE="RCTEST0001";
export async function POST(request:NextRequest){const actor=await requireAdminPermission(request,"SETTINGS_ADMIN");if(!actor)return receiptError(401,"UNAUTHORIZED","管理者認証が必要です");const now=Date.now(),existing=await env.DB.prepare("SELECT id,member_code AS memberCode,status FROM members WHERE member_code=? LIMIT 1").bind(TEST_CODE).first<{id:string;memberCode:string;status:string}>();if(existing)return receiptResponse({ok:true,idempotentReplay:true,member:{memberCode:existing.memberCode,status:existing.status}});await env.DB.prepare("INSERT INTO members(id,member_code,display_name,points_balance,member_rank,resident_status,status,verification_status,source_system,created_at,updated_at) VALUES(?,?,'電子レシート接続試験',0,'STANDARD','UNKNOWN','ACTIVE','ACTIVE','ELECTRONIC_RECEIPT_TEST',?,?)").bind(crypto.randomUUID(),TEST_CODE,now,now).run();return receiptResponse({ok:true,idempotentReplay:false,member:{memberCode:TEST_CODE,status:"ACTIVE"}},201)}
