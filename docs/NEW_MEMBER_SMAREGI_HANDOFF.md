# 新規会員・スマレジ連携 引き継ぎ

会員証側で新規登録が完了すると、ローカル会員番号の発行と同時にスマレジ連携待ちキューへ登録されます。セルフレジ／スマレジ連携側は、このキューを定期取得して顧客登録を行ってください。

## 取得

`GET /api/v1/pos/member-registrations?status=PENDING`

既存のPOS認証トークンを使用します。返却される `memberCode`、氏名、電話番号、生年月日、郵便番号、住所、メールアドレスをスマレジ顧客登録へ使用します。

## 状態通知

`POST /api/v1/pos/member-registrations/{memberCode}`

```json
{
  "status": "SYNCED",
  "sourceCustomerId": "スマレジ顧客ID",
  "requestId": "処理ごとに一意のID"
}
```

処理開始時は `SYNCING`、失敗時は `FAILED` と `error` を送信します。同じ `requestId` は二重処理されません。失敗分は会員管理画面 `/member-admin` から再試行待ちへ戻せます。

## 重要事項

- スマレジ側で会員番号を再採番せず、会員証側が発行した10文字を使用する
- スマレジ登録に失敗しても会員証側の会員を削除しない
- 再送時は会員番号を冪等キーとして既存顧客を検索してから登録する
- 同期完了後に `sourceCustomerId` を必ず返す
