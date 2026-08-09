# FEBBRAIO セルフレジ連携 API v1

Base URL: `https://compassion-world-members-card.combetter27.chatgpt.site`

すべてのリクエストに `Authorization: Bearer {POS_API_TOKEN}` を付ける。金額はすべて円の整数。APIは税抜・税額・税込を併記する。

## 精算対象セッション取得

`GET /api/v1/pos/sessions?memberCode={会員証コード}`

成功時は `sessionId`, `memberCode`, `studioId`, `reservationId`, `checkedInAt`, `scheduledEndsAt`, `status`, `paymentStatus`, `planType`, `productCode`, `unitPriceExcludingTax`, `taxRateBps`, `totalExcludingTax`, `taxAmount`, `totalIncludingTax`, `currency`, `version` を返す。

## 決済成功通知

`POST /api/v1/pos/sessions/{sessionId}/payments`

追加ヘッダー: `Idempotency-Key: {16〜128文字のレジ側一意キー}`

```json
{
  "result": "SUCCESS",
  "source": "FEBBRAIO_SELF_REGISTER",
  "paymentId": "POS-20260810-000123",
  "paidAt": 1786305600000,
  "totalExcludingTax": 5000,
  "taxAmount": 500,
  "totalIncludingTax": 5500
}
```

成功時、セッションは `IN_USE / UNPAID` から `COMPLETED / PAID` へ更新される。同じ `Idempotency-Key` と `paymentId` の再送には成功応答と `idempotentReplay: true` を返す。別の決済で同じキーを再利用した場合は拒否する。

決済成功の通知元はセルフレジGASとし、セルフレジが実機の決済成功を確認した後だけ本APIを呼ぶ。失敗・キャンセル時は呼ばないため、セッションは `IN_USE / UNPAID` のまま維持される。

## エラーコード

- `UNAUTHORIZED`: APIトークン不正
- `INVALID_MEMBER_CODE`: 会員証コード形式不正
- `SESSION_NOT_FOUND`: 精算対象なし
- `MULTIPLE_ACTIVE_SESSIONS`: 利用中セッション重複
- `PRICE_NOT_READY`: 料金未確定
- `INVALID_IDEMPOTENCY_KEY`: 冪等性キー形式不正
- `IDEMPOTENCY_KEY_REUSED`: 別決済でキー再利用
- `INVALID_PAYMENT_NOTIFICATION`: 成功通知形式不正
- `SESSION_NOT_PAYABLE`: 精算対象外状態
- `AMOUNT_MISMATCH`: 金額不一致
- `SESSION_CONFLICT`: 同時更新競合

HTTPステータスは入力不正 `400`、認証失敗 `401`、対象なし `404`、状態・金額・競合 `409` を使用する。
