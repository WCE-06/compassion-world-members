# 共通会員認証API

## エンドポイント

`POST /api/v1/member-verification`

スマレジ、GAS、ポイント、予約APIを呼ばず、会員管理システムの会員DBだけを読み取ります。

## 認証

`Authorization: Bearer {用途別トークン}`

トークンは本番の秘密設定で管理し、ソースコードやGitHubへ保存しません。セルフレジ用トークンでは `system: SELF_REGISTER` 以外を照会できません。

## リクエスト

```json
{"memberCode":"650A0DB2F6","system":"SELF_REGISTER","deviceId":"SELF-REGISTER-01","requestId":"UUID"}
```

- `memberCode`: 大文字半角英数字10文字
- `system`: `SELF_REGISTER`、`ENTRANCE`、`STUDIO_RECEPTION`、`RESERVATION`、`MOBILE_ORDER`
- `deviceId`: 大文字半角英数字と `- _ . :`
- `requestId`: UUID

## 正常応答

業務上の認証結果はすべてHTTP 200で返します。`result` は `ACTIVE`、`SUSPENDED`、`WITHDRAWN`、`UNREGISTERED` のいずれかです。`verified` が `true` になるのは `ACTIVE` だけです。

## エラー

- 400 `INVALID_REQUEST`: 入力形式不正
- 401 `UNAUTHORIZED`: トークン不正または用途不一致
- 409 `REQUEST_ID_CONFLICT`: 同じrequestIdを異なる内容で再利用
- 503 `VERIFICATION_SERVICE_UNAVAILABLE`: 会員DBまたは監査記録に接続できない

同じ内容・同じrequestIdの再照会は、最初の結果を返し `X-Idempotent-Replay: true` を付与します。

## 監査

requestId、system、deviceId、認証結果、HTTP状態、所要時間、照会内容の指紋を保存します。会員番号はSHA-256ハッシュだけを監査台帳へ保存し、平文では記録しません。
