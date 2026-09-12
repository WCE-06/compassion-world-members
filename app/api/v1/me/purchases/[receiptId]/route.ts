import {NextRequest} from "next/server";
import {authenticatedLiveMember} from "@/lib/member-auth";
import {auditReceipt,receiptError,receiptResponse} from "@/lib/receipt-api";
import {publicPurchase,purchaseByReceipt,purchaseItems} from "@/lib/receipt-view";
export async function GET(request:NextRequest,context:{params:Promise<{receiptId:string}>}){const member=await authenticatedLiveMember(request);if(!member)return receiptError(401,"UNAUTHORIZED","会員認証が必要です");const{receiptId}=await context.params,row=await purchaseByReceipt(receiptId);if(!row||row.memberId!==member.id)return receiptError(404,"PURCHASE_NOT_FOUND","購入履歴が見つかりません");await auditReceipt({actorType:"MEMBER",actorId:member.id,action:"PURCHASE_GET",receiptId,transactionId:row.transactionId,result:"SUCCESS"});return receiptResponse({ok:true,purchase:publicPurchase(row,await purchaseItems(row.id))})}
