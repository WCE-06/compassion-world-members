# セルフレジ向け モバイルオーダー現地決済API

更新日: 2026-08-23

## 共通条件

- ベースURL: `https://compassion-world-members-card.combetter27.chatgpt.site`
- 認証: `Authorization: Bearer {POS_API_TOKEN}`
- 会員番号: 大文字半角英数字10文字
- 未決済注文の有効時間: 注文作成から15分
- 精算ロック: 5分
- 注文期限前に取得したロックは、ロック期限まで決済完了を受け付ける
- Android強制終了時は、再起動後に同じ`requestId`でロック取得を再送する。復旧しなければ5分で自動失効する
- 呼出番号は期限切れ時に`CANCELLED`へ変更するが再利用しない。店内表示で同じ番号が別注文へ移る事故を防ぐ
- 決済成功時は`PAID`更新、キッチンの`ACCEPTED`更新、ロックの`CONSUMED`化を同じ一括処理で行う
- 注文価格は15分間の確定価格。ロック時に商品・売り切れ・販売時間・商品コード・価格を再検証し、価格変更時は`PRICE_CHANGED`を返して再注文を求める
- 無料オプションはキッチン指示のみ、有料オプションはスマレジ商品コード付きで返す。初期版の注文画面ではオプション選択UIは未接続のため`selectedOptions`は空配列になる

## 1. 未決済注文取得

`GET /api/v1/orders/unpaid?memberCode={memberCode}`

対象会員の`WAITING_STORE_PAYMENT`と`PAYMENT_PROCESSING`を作成順ですべて返す。期限切れ注文と期限切れロックは取得時に整理される。0件は正常応答として`orders: []`を返す。

```json
{
  "ok": true,
  "orders": []
}
```

## 2. 精算ロック取得

`POST /api/v1/orders/{orderId}/payment-lock`

```json
{"requestId":"一意なID","deviceId":"SELF-REGISTER-01"}
```

同じ`requestId`・同じ端末の再送は同じロックを返し、`idempotentReplay: true`となる。別端末が保持中なら`ORDER_LOCKED`。応答の`order`には再検証済みの商品・税・合計を含む。

## 3. ロック解除

`POST /api/v1/orders/{orderId}/payment-lock/release`

```json
{"requestId":"取得時と同じID","lockId":"ロックID","deviceId":"SELF-REGISTER-01","reason":"CUSTOMER_CANCELLED"}
```

同じ解除の再送は成功扱い。注文期限内なら`WAITING_STORE_PAYMENT`へ戻し、期限後なら`EXPIRED`にする。

## 4. 決済完了通知

`POST /api/v1/orders/payment-confirmation`

```json
{
  "orderId":"内部注文ID",
  "paymentId":"スマレジ取引ID",
  "requestId":"決済通知の一意なID",
  "lockId":"ロックID",
  "deviceId":"SELF-REGISTER-01",
  "paidAt":"2026-08-23T00:00:00+09:00"
}
```

```json
{
  "ok":true,
  "orderId":"内部注文ID",
  "paymentId":"スマレジ取引ID",
  "orderStatus":"PAID",
  "kitchenStatus":"ACCEPTED",
  "foodCallNumber":"F012",
  "drinkCallNumber":"D008",
  "idempotentReplay":false,
  "fulfillments":[]
}
```

旧セルフレジとの互換性のため`orderId`と`paymentId`だけの通知も当面受理する。ただしロック取得済みの注文では`lockId`と`deviceId`が必須。

## エラー

| HTTP | code | 意味 |
|---:|---|---|
| 400 | `INVALID_REQUEST` / `PAYMENT_ID_REQUIRED` | 入力不足・形式不正 |
| 401 | `UNAUTHORIZED` | POSトークン不正 |
| 404 | `MEMBER_NOT_FOUND` / `ORDER_NOT_FOUND` | 対象なし |
| 409 | `ORDER_ALREADY_PAID` / `ORDER_CANCELLED` | 精算不可状態 |
| 409 | `ORDER_LOCKED` / `LOCK_EXPIRED` / `LOCK_NOT_OWNED` | ロック競合・所有不一致 |
| 409 | `PRICE_CHANGED` | 注文時から価格変更。注文を作り直す |
| 409 | `PRODUCT_UNAVAILABLE` / `PRODUCT_SOLD_OUT` | 現在販売不可 |
| 409 | `DUPLICATE_PAYMENT_ID` | 別注文で同じスマレジ取引IDを使用済み |
| 409 | `PAYMENT_CONFIRMATION_CONFLICT` | 冪等キーと内容の不一致 |
| 410 | `ORDER_EXPIRED` | 注文期限切れ |
| 503 | `PRODUCT_UNAVAILABLE` | 商品マスターの再確認不能 |

エラー形式は`{"ok":false,"error":"ERROR_CODE","message":"任意の説明"}`。

`NO_UNPAID_ORDER`と`MULTIPLE_UNPAID_ORDERS`は使用しない。未決済取得APIは常に配列で返すため、0件・複数件を正常系としてセルフレジが扱う。`OPTION_UNAVAILABLE`、`KITCHEN_ACCEPT_FAILED`はオプション選択・キッチン再試行の本接続時に追加する。
