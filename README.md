# 酒場図-SAKABA-ZU- 公開手順(GitHub Pages + Firebase)

友達同士で居酒屋の「行きたい店」「行った店」を記録して、今日どこで飲むかすぐ決めるWebアプリです。
仕様やコードの構成は `OVERVIEW.md` を見てください。

## このフォルダのファイル

| ファイル | 役割 |
|---|---|
| `index.html` | 入口(`sakabazu.html` へ移動するだけ) |
| `sakabazu.html` | アプリ本体 |
| `css/`、`js/` | 見た目と動き |
| `firebase-config.js` | Firebase とホットペッパーの設定(手順4と「ホットペッパーのAPIキー」で貼り付ける) |
| `firestore.rules` | データを守るルール(手順3で Firebase に貼る) |
| `manifest.webmanifest`、`icon-192.png`、`icon-512.png`、`apple-touch-icon.png` | ホーム画面に追加したときのアプリ情報 |
| `firebase.json` | 手元でテストするときの設定(アップロード不要) |
| `README.md`、`OVERVIEW.md` | この説明と仕様(アップロード不要) |

## 1. Firebase のプロジェクトを作る

1. https://console.firebase.google.com を開き、Google アカウントでログインする
2. 「プロジェクトを作成」を押す
3. プロジェクト名に `sakabazu` などを入れて進む
4. Google アナリティクスは使わないので「オフ」にして、作成する

## 2. ログイン方法をオンにする(匿名と Google)

1. 左のメニューの「構築」→「Authentication」→「始める」
2. 「Sign-in method」(ログイン方法)タブを開く
3. 「匿名」を選び、「有効にする」をオンにして保存する
   (友達がログイン操作をしなくても、端末ごとに見分けられるようにする設定です)
4. 「新しいプロバイダを追加」→「Google」を選び、「有効にする」をオンにする
5. 「プロジェクトのサポートメール」に自分のメールアドレスを選んで保存する
   (スマホとPCで同じ人として使うための「Googleと連携」に使います)

## 3. データベースを作ってルールを貼る

1. 左のメニューの「構築」→「Firestore Database」→「データベースを作成」
2. ロケーションは `asia-northeast1 (Tokyo)` を選ぶ(あとから変えられません)
3. 「本番環境モードで開始」を選んで作成する
4. 作成できたら「ルール」タブを開く
5. 最初から入っている文字をすべて消し、このフォルダの `firestore.rules` の中身をすべてコピーして貼り付ける
6. 「公開」を押す

## 4. 設定をコピーする

1. 左上の歯車マーク →「プロジェクトの設定」
2. 下のほうの「マイアプリ」で、ウェブのマーク `</>` を押す
3. アプリのニックネームに `sakabazu` などを入れて「アプリを登録」
   (「Firebase Hosting も設定する」のチェックは不要です)
4. 表示されたコードのうち、`const firebaseConfig = { ... };` の `{ }` の中身をコピーする
5. このフォルダの `firebase-config.js` を開き、`window.FIREBASE_CONFIG = { ... };` の `{ }` の中に貼り付けて保存する

貼り付けたあとは、たとえば次のようになります(値は人によって違います)。

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "sakabazu-xxxx.firebaseapp.com",
  projectId: "sakabazu-xxxx",
  storageBucket: "sakabazu-xxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

> この値は公開されても問題ありません。データは手順3のルールで守られています。

## ホットペッパーのAPIキー

「探」ボタンでお店を探すのに使います(無料)。空のままでもアプリは動き、「探」は Googleマップ検索へのリンクだけになります。

1. https://webservice.recruit.co.jp/ を開き、「新規登録」からメールアドレスを登録する
2. 届いたメールの案内に沿って登録を終えると、APIキーが表示される(メールでも届きます)
3. `firebase-config.js` の `window.HOTPEPPER_KEY = "";` の `""` の中にキーを貼り付けて保存する

> 利用規約により、検索結果の近くに「Powered by ホットペッパーグルメ Webサービス」の表示が必要です。アプリにはすでに入っているので、消さないでください。

## 5. GitHub で公開する

1. https://github.com にログインする
2. 右上の「+」→「New repository」
3. Repository name に `sakabazu` と入れ、**Public** を選んで「Create repository」
4. 「uploading an existing file」のリンクを押す
5. 次のファイルとフォルダをドラッグして置き、下の「Commit changes」を押す
   - `index.html`、`sakabazu.html`、`firebase-config.js`
   - `css` フォルダ、`js` フォルダ
   - `manifest.webmanifest`、`icon-192.png`、`icon-512.png`、`apple-touch-icon.png`
6. リポジトリの「Settings」→ 左の「Pages」
7. 「Branch」で `main` と `/ (root)` を選び「Save」
8. 1〜2分待つと、上に公開URLが出ます
   `https://ma-ookami.github.io/sakabazu/`

## 6. 公開URLを Firebase に登録する

1. Firebase の「Authentication」→「設定」タブ →「承認済みドメイン」
2. 「ドメインの追加」で `ma-ookami.github.io` を追加する
   (これがないと「Googleと連携」「Googleでログイン」ができません)

## 7. 動作確認

1. 公開URLを開き、ニックネームを入れて「はじめる」
2. 「リスト」タブで店名を入れて＋、または「探」でお店を探して追加する
3. 右上の「招待する」→「友達を招待する」のリンクをコピーする
4. スマホや、パソコンのシークレットウィンドウでそのリンクを開き、別の名前で参加する
5. 片方で追加した店が、もう片方にすぐ出れば完成です
6. 「招待する」(メンバー)→「Googleと連携する」を押しておくと、ほかの端末でも「Googleでログイン」だけで同じ自分として使えます

---

## うまくいかないとき

| 表示・症状 | よくある原因 |
|---|---|
| 「この端末だけに保存しています(Firebase が未設定)」 | `firebase-config.js` を貼り付けていない、またはアップロードし忘れている |
| 「サーバーにつながりませんでした」 | 手順2の「匿名」がオンになっていない |
| 「はじめる」を押しても進まない・「保存できませんでした」 | 手順3のデータベース作成、またはルールの「公開」がまだ。ルールが途中で切れていたら丸ごと貼り直す |
| 「Googleでログインできませんでした」 | 手順2の「Google」がオフ、または手順6の承認済みドメインが未登録 |
| 「お店検索のキーが正しくないか、使えない状態です」 | `HOTPEPPER_KEY` の貼り間違い(前後の空白など) |
| ページが404になる | Pages 設定後、数分待っていない。URLの最後の `/sakabazu/` を確認 |

## ほかの端末で使う

- **Googleと連携(おすすめ)**: 最初に参加した端末で「招待する(メンバー)」→「Googleと連携する」。ほかの端末では、アプリを開いて「Googleでログイン」を押すだけで同じ自分になります。
- **合言葉**: 「メンバー」→「合言葉」で4桁の数字を設定。ほかの端末で招待リンクを開き、「前に参加した人として入る」→自分の名前→合言葉で入れます。
  合言葉を設定しないと、招待リンクを知っている人なら誰でもあなたとして入れてしまうので、設定しておくのがおすすめです。

## App Check を設定する(無料枠を荒らされないように・任意)

本物のアプリ(公開ページ)以外からのアクセスを Firebase が弾くようになります。手順は ますせん の README の「App Check を設定する」と同じです(プロジェクトとキーの名前を `sakabazu` にして、サイトキーを `firebase-config.js` の `APPCHECK_SITE_KEY` に貼る)。

- **サイトキーを入れたファイルをアップロードする前に「適用」すると、アプリが動かなくなります。** 1日ほど使って「確認済みのリクエスト」が増えているのを見てから適用してください。

## ホーム画面に追加する(アプリのように使う)

**iPhone(Safari)**: 共有ボタン(□に↑)→「ホーム画面に追加」
**Android(Chrome)**: 右上の「︙」→「ホーム画面に追加」(または「アプリをインストール」)

- iPhone のホーム画面のアプリは Safari とは別のブラウザ扱いです。最初の1回は「Googleでログイン」するか、招待リンクを開いて「前に参加した人として入る」で入ってください。

## アプリを更新するとき

1. 手元で確認する:`sakabazu` フォルダで `npx http-server -p 8080 -c-1` を動かし、http://localhost:8080 を開く
2. 変えたファイルを GitHub にアップロード(または VS Code でコミットして同期)
3. 1〜2分で公開サイトに反映されます
4. `firestore.rules` を変えたときは、Firebase の「Firestore Database」→「ルール」に貼り直して「公開」も必要です

## 知っておくこと

- 無料の Spark プランで動きます(Firestore は1日あたり読み取り5万回・書き込み2万回まで)。友達同士なら十分です。
- 以前の claude.ai 共有ページ版のデータは移していません。
