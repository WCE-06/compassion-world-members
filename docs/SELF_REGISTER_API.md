# FEBBRAIO セルフレジ参照 API v1

Base URL: `https://compassion-world-members-card.combetter27.chatgpt.site`

## 利用中情報の取得

`GET /api/v1/febbraio/active-usage?memberCode={会員証コード}`

ヘッダー: `Authorization: Bearer {POS_API_TOKEN}`

利用中の場合:

```json
{
  "found": true,
  "memberCode": "会員証コード",
  "checkedInAt": 1786302000000,
  "memberRank": "STANDARD",
  "usageMinutes": 73,
  "billingHours": 2,
  "productCode": "STN02"
}
```

利用していない場合:

```json
{
  "found": false,
  "code": "NO_ACTIVE_USAGE"
}
```

`usageMinutes` は利用開始から現在までの経過分を切り捨てた整数。`billingHours` は60分単位で切り上げ、最低1時間、最大10時間。通常会員は `STN01`〜`STN10`、住民会員は `STR01`〜`STR10` を返す。

同じ会員に利用中ログが複数ある場合は HTTP 409 / `MULTIPLE_ACTIVE_USAGES`。ログの必須項目が欠けている場合は HTTP 409 / `ACTIVE_USAGE_INCOMPLETE`。認証失敗は HTTP 401 / `UNAUTHORIZED`、会員証コード形式不正は HTTP 400 / `INVALID_MEMBER_CODE`。

このAPIは参照専用であり、利用終了、決済完了、退店処理、セッション更新を行わない。
