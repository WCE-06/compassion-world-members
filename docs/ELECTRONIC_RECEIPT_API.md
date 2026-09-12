# 電子レシートAPI v1

本番ベースURL：`https://members.wce-group-japan.com`

## 共通認証

セルフレジAPIは次のヘッダーを使用する。

```http
Authorization: Bearer {端末トークン}
Content-Type: application/json
```

端末トークンは管理者が`POST /api/v1/admin/receipt-devices`で発行する。平文は発行時の応答に一度だけ含まれ、D1には`RECEIPT_TOKEN_PEPPER`を用いたハッシュだけを保存する。セルフレジではOSの暗号化領域へ保存し、ログやGitHubへ記録しない。

推奨端末：`SELF-REGISTER-01`、権限：`purchase:create`、`purchase:read-status`、`purchase:adjust`。

## 共通エラー

```json
{
  "ok": false,
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "同じ取引IDまたはrequestIdに異なる内容が送信されました",
    "retryable": false
  },
  "requestId": "UUID"
}
```

- `400 INVALID_REQUEST`：入力形式不正
- `401 UNAUTHORIZED`：端末認証不正・失効・権限不足
- `404 MEMBER_NOT_FOUND` / `PURCHASE_NOT_FOUND`：対象なし
- `409 IDEMPOTENCY_CONFLICT`：同一キーで内容不一致。自動再送を停止する
- `409 INVALID_STATUS_TRANSITION`：許可されない状態遷移
- `422 TOTAL_MISMATCH`：明細合計不一致
- `422 PAYMENT_BREAKDOWN_MISMATCH`：支払内訳不一致
- `422 ELECTRONIC_RECEIPT_REQUIRED`：5万円以上で電子レシート未選択
- `503 *_UNAVAILABLE`：一時障害。`retryable: true`の場合だけ同じ内容・同じIDで再送する

## 取引登録

`POST /api/v1/purchases`

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionId": "スマレジ取引ID",
  "memberCode": "RCTEST0001",
  "storeId": "OMOHIDE",
  "storeName": "おもひで商店",
  "transactionDateTime": "2026-09-13T01:00:00+09:00",
  "status": "CONFIRMED",
  "receiptMode": "ELECTRONIC",
  "currency": "JPY",
  "items": [{
    "productCode": "TEST-001",
    "productName": "接続試験商品",
    "quantity": 1,
    "unitPriceIncludingTax": 110,
    "lineTotal": 110,
    "taxRate": 10,
    "options": []
  }],
  "subtotal": 100,
  "taxTotal": 10,
  "totalIncludingTax": 110,
  "pointsUsed": 0,
  "paymentMethod": "CASH",
  "paymentBreakdown": {
    "cash": 110,
    "credit": 0,
    "electronicMoney": 0,
    "qr": 0,
    "points": 0,
    "other": 0
  }
}
```

成功は`201`、同一内容の再送は`200`と`X-Idempotent-Replay: true`を返す。

```json
{
  "ok": true,
  "idempotentReplay": false,
  "purchase": {
    "receiptId": "RCP-...",
    "transactionId": "スマレジ取引ID",
    "status": "CONFIRMED",
    "receiptMode": "ELECTRONIC",
    "electronicReceiptAvailable": true
  }
}
```

売上結果が不明な場合だけ`status: PAYMENT_UNKNOWN`で保存する。確定電子レシートはまだ表示しない。

## PAYMENT_UNKNOWNの照会・確定

```http
GET /api/v1/purchases/status?transactionId={スマレジ取引ID}
```

`PAYMENT_UNKNOWN`から成立確認後に確定する場合：

```http
POST /api/v1/purchases/status
```

```json
{
  "requestId": "UUID",
  "transactionId": "スマレジ取引ID",
  "status": "CONFIRMED",
  "confirmedAt": "2026-09-13T01:00:10+09:00"
}
```

## 取消・返品

```http
POST /api/v1/purchases/{receiptId}/adjustments
```

```json
{
  "requestId": "UUID",
  "type": "CANCEL",
  "sourceTransactionId": "スマレジ取消取引ID",
  "amount": 110,
  "reason": "取引取消",
  "items": [],
  "occurredAt": "2026-09-13T01:05:00+09:00"
}
```

`type`は`CANCEL`または`RETURN`。元記録は削除せず、取消・返品台帳を追加して状態を更新する。

## 会員本人用API

すべてLINEアクセストークンによる本人認証が必要。会員コードだけでは取得できない。

- `GET /api/v1/me/purchases?limit=20&cursor={epoch_ms}`
- `GET /api/v1/me/purchases/{receiptId}`
- `GET /api/v1/me/purchases/{receiptId}/pdf`

一覧は`storeId`、`status`、`from`、`to`で絞り込みできる。PDF画面はブラウザの「PDFとして保存」と端末共有に対応する。`NONE`および`PAYMENT_UNKNOWN`では発行しない。

## 管理API

- `GET /api/v1/admin/receipt-devices`：端末一覧
- `POST /api/v1/admin/receipt-devices`：発行・ローテーション
- `DELETE /api/v1/admin/receipt-devices`：失効
- `POST /api/v1/admin/receipt-test-member`：専用試験会員`RCTEST0001`を冪等作成

管理者セッションと`SETTINGS_ADMIN`権限を必須とする。

## 保存先

- D1：購入、明細、取消・返品、端末、電子レシート原本メタデータ、監査記録
- R2：既存バケット内の専用非公開プレフィックス`electronic-receipts/`

R2のデータは公開配信APIから参照させない。購入時点の原本JSONを保存し、商品マスタ変更後も同じ内容を再表示できる。

## 接続試験

1. 管理画面から`RCTEST0001`を作成する。
2. `SELF-REGISTER-01`のトークンを発行し、端末の暗号化領域へ保存する。
3. `PAYMENT_UNKNOWN`を登録して照会する。
4. 成立確認後に`CONFIRMED`へ更新する。
5. 同じ取引を同じ内容で再送し、重複しないことを確認する。
6. 同じ取引IDを異なる金額で送り、409になることを確認する。
7. 無効トークンで401になることを確認する。
8. 取消と返品を登録し、元取引が物理削除されないことを確認する。
9. LINE連携した専用試験会員で一覧・詳細・電子レシートを確認する。
10. 実在顧客および実売上は使用しない。
