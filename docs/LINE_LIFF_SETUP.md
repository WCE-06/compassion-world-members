# LINE・LIFF 本番設定

## LINE Developers Console

1. COMPASSION WORLDで使用するProviderを選択する。
2. LINE Loginチャネルを作成または既存チャネルを選択する。
3. LIFFアプリ名を `COMPASSION WORLD POINT CARD` とする。
4. サイズを `Full` にする。
5. Endpoint URLへ本番サイトのHTTPS URLを設定する。
6. Scopeは初期版では `profile` のみを有効にする。
7. 外部ブラウザでのLINE Loginを有効にする。
8. 発行されたLIFF IDをSitesの `LINE_LIFF_ID` に登録する。
9. LINE Login Channel IDをSitesの `LINE_LOGIN_CHANNEL_ID` に登録する。
10. 同じProvider内のCOMPASSION WORLD公式アカウントを「リンクされたLINE公式アカウント」に設定する。
11. LIFFの「友だち追加オプション」を `On (aggressive)` にする。

`email` と `openid` は初期移行では使用しない。メールアドレスは会員登録フォームの任意入力とし、LINEから取得しない。

## 開発用確認

- 本番リッチメニューは変更しない。
- まず `https://liff.line.me/{LIFF_ID}` を代表アカウントへ送って開く。
- 登録済み会員は入力なしで既存会員番号・ポイントが表示されることを確認する。
- 会員番号が空欄だったLINE会員は新規登録画面へ移ることを確認する。
- LINE外のSafari・Chromeから開いた場合もLINE Login後に戻ることを確認する。
- 代表アカウントの確認完了後に少人数へ展開する。

## 本番で使用するリンク

- リッチメニュー（既存会員を優先）：`https://liff.line.me/2011207283-2WHiwNQT`
- 新規会員登録（店頭QR・Web・案内物）：`https://liff.line.me/2011207283-2WHiwNQT/?entry=join`

登録用リンクを開いた利用者は、LINEログインと友だち追加確認を経て、次のように自動振り分けされる。

1. LINE User IDが既存会員に紐付いている場合は、そのまま会員証を表示する。
2. LメンバーズCSVにLINE User IDがあり会員番号が空欄の場合は、移行済みの登録情報を初期入力した会員登録画面を表示する。
3. CSVに存在しない新規利用者は、会員番号引継ぎ画面を挟まず会員登録画面を表示する。
4. 登録完了後は、発行した会員番号とQRを持つ会員証を同じ画面に表示する。

既存会員向けのリッチメニューURLでは、紐付けが見つからない場合に会員番号・電話番号・生年月日による引継ぎ画面を表示し、誤って新規会員を二重作成しない。

## 全員移行のCSV判定（2026年8月23日）

- CSV総数：188件
- 会員番号あり・自動移行対象：131件
- 会員番号なし・初回登録対象：56件
- LINE User IDなし・未登録扱い：1件
- 会員番号重複：0件
- LINE User ID重複：0件

本番取込は `scripts/import-legacy-customers.mjs` の事前検査を通し、50件ずつ冪等に登録する。同じCSVを再送しても会員番号・LINE User IDをキーに更新し、会員を重複作成しない。

## サーバー側の確認

- ブラウザから受け取るプロフィール項目を本人確認情報として信用しない。
- LIFF access tokenをLINEの検証APIで確認し、Channel IDが一致する場合だけ利用する。
- LINE User IDはサーバーがLINE Profile APIから取得する。
- 会員番号やLINE User IDをURLへ含めない。
- 移行用秘密鍵は取込完了後に削除する。
