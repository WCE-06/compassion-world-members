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

`email` と `openid` は初期移行では使用しない。メールアドレスは会員登録フォームの任意入力とし、LINEから取得しない。

## 開発用確認

- 本番リッチメニューは変更しない。
- まず `https://liff.line.me/{LIFF_ID}` を代表アカウントへ送って開く。
- 登録済み会員は入力なしで既存会員番号・ポイントが表示されることを確認する。
- 会員番号が空欄だったLINE会員は新規登録画面へ移ることを確認する。
- LINE外のSafari・Chromeから開いた場合もLINE Login後に戻ることを確認する。
- 代表アカウントの確認完了後に少人数へ展開する。

## サーバー側の確認

- ブラウザから受け取るプロフィール項目を本人確認情報として信用しない。
- LIFF access tokenをLINEの検証APIで確認し、Channel IDが一致する場合だけ利用する。
- LINE User IDはサーバーがLINE Profile APIから取得する。
- 会員番号やLINE User IDをURLへ含めない。
- 移行用秘密鍵は取込完了後に削除する。
