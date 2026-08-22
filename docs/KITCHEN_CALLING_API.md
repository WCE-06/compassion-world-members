# キッチン呼出番号仕様

レシート番号は顧客呼出しに使用しません。1つの注文にフードとドリンクが含まれる場合、それぞれ独立した呼出番号を発行します。

## 番号

- フードとドリンクで別々に採番する
- 営業日ごとに001から開始する
- 顧客画面は常に3桁で表示する
- 内部注文ID・スマレジ取引ID・レシート番号とは分離する
- フードとドリンクは完成順に個別でREADY・CALL・PICKUPへ進める
- 決済前は `WAITING_PAYMENT` とし、呼出一覧へは出さない
- セルフレジまたはStripeの決済成功後に `ACCEPTED` へ変更する

## キッチンAPI

すべてのリクエストに `Authorization: Bearer <KITCHEN_API_TOKEN>` が必要です。

### 待ち一覧

`GET /api/v1/kitchen/fulfillments?department=FOOD`

`department` は `FOOD` または `DRINK` です。レスポンスには呼出番号、状態、その部門の商品と数量が含まれます。

### 状態更新

`PATCH /api/v1/kitchen/fulfillments`

```json
{
  "fulfillmentId": "呼出単位ID",
  "action": "READY"
}
```

`action` は `START`、`READY`、`CALL`、`PICKUP` です。`CALL` はREADYになった部門だけ実行できます。
