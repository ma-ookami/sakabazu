# 酒場図-SAKABA-ZU- 公開手順(GitHub Pages + Firebase)

友達同士で居酒屋の「行きたい店」「行った店」を記録して、今日どこで飲むかすぐ決めるWebアプリです。
仕様やコードの構成は `OVERVIEW.md` を見てください。

## このフォルダのファイル

| ファイル | 役割 |
|---|---|
| `index.html` | 入口(`sakabazu.html` へ移動するだけ) |
| `sakabazu.html` | アプリ本体 |
| `css/`、`js/` | 見た目と動き |
| `firebase-config.js` | Firebase の設定とホットペッパー中継のURL(手順4と「ホットペッパー検索の中継を作る」で貼り付ける) |
| `firestore.rules` | データを守るルール(手順3で Firebase に貼る) |
| `manifest.webmanifest`、`icon-192.png`、`icon-512.png`、`apple-touch-icon.png` | ホーム画面に追加したときのアプリ情報 |
| `worker/hotpepper-proxy.js` | ホットペッパー検索の中継(Cloudflare に貼る。GitHub に置いても問題なし。キーは入っていない) |
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

## ホットペッパー検索の中継を作る(Cloudflare Workers)

「探」ボタンでお店を探すのに使います(どちらも無料)。やらなくてもアプリは動き、「探」は Googleマップ検索へのリンクだけになります。
APIキーをページに載せると誰でも見られてしまうので、キーは Cloudflare 側に保存し、アプリは中継(Worker)を呼びます。

**A. ホットペッパーのAPIキーを取る**
1. https://webservice.recruit.co.jp/ を開き、「新規登録」からメールアドレスを登録する
2. 届いたメールの案内に沿って登録を終えると、APIキーが表示される(メールでも届きます)
   **このキーは `firebase-config.js` には貼りません。**

**B. Worker を作る**
1. https://dash.cloudflare.com/sign-up でアカウントを作る(カード登録は不要)
2. 左のメニュー「Compute(Workers)」→「Workers & Pages」→「作成」→「Worker を作成」(Hello World)
3. 名前を `sakabazu-hp` などにして「デプロイ」
4. 「コードを編集」を押し、最初から入っている文字をすべて消して、このフォルダの `worker/hotpepper-proxy.js` の中身を貼り付け、「デプロイ」
5. Worker の画面に戻り「設定」→「変数とシークレット」→「追加」
   - 種類: **シークレット**、名前: `HOTPEPPER_KEY`、値: Aで取ったAPIキー → 「デプロイ」
6. Worker の URL(`https://sakabazu-hp.(あなたの名前).workers.dev`)をコピーする

**C. アプリに URL を入れる**
- `firebase-config.js` の `window.HOTPEPPER_PROXY = "";` の `""` の中に、B-6 の URL を貼り付けて保存する

> 中継は `https://ma-ookami.github.io` と手元(localhost)のページからしか使えないようにしてあります。公開URLが変わったら `worker/hotpepper-proxy.js` の `ALLOWED` を直して貼り直してください。

> 利用規約により、検索結果の近くに「Powered by ホットペッパーグルメ Webサービス」の表示が必要です。アプリにはすでに入っているので、消さないでください。

## Google のお店検索を使う(Places API)

お店検索の「Google」は、上と同じ Worker が Google の Places API を呼んでいます。キーは Worker のシークレットに置くので、ページには載りません。

**A. Google のキーを作る**
1. https://console.cloud.google.com/ を開き、Google アカウントでログインする
2. 上の「プロジェクトを選択」→「新しいプロジェクト」(名前は `sakabazu` など)→「作成」
3. 「お支払い」でクレジットカードを登録する(Places API に必要。毎月の無料枠があるので、まずはその中で使える想定。料金は登録前に Google の料金ページで確認)
4. 左のメニュー「API とサービス」→「ライブラリ」→「Places API (New)」を探して「有効にする」
5. 「API とサービス」→「認証情報」→「認証情報を作成」→「API キー」
6. 作ったキーの「キーを制限」→「API の制限」で「Places API (New)」だけにチェックして保存(アプリケーションの制限は「なし」のままでよい。キーは Worker の中だけで使う)
7. 心配なら「お支払い」→「予算とアラート」で、月の上限額のお知らせを作っておく

**B. Worker に入れる**
1. Cloudflare の `sakabazu-hp` Worker →「設定」→「変数とシークレット」→「追加」
2. 種類は「シークレット」、名前は `GOOGLE_PLACES_KEY`、値に A-5 のキーを貼って保存
3. 「コードを編集」で中身を `worker/hotpepper-proxy.js` に丸ごと貼り替えて「デプロイ」

> Google から取っているのは、店名・住所・位置・ジャンル・★評価と口コミ数・価格帯・営業時間・Googleマップのリンク。★評価や営業時間を取るぶん、料金区分は高いほうになります(取る項目は `worker/hotpepper-proxy.js` の `G_FIELDS`)。同じ検索は10分キャッシュしています。

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

1. 公開URLを開く(最初は自動で自分のリストができる)
2. 決める画面の「お店をリストに追加」でお店を探して追加する
3. 右上のアイコン →「飲み友」で自分の飲み友コードを表示する
4. スマホや、パソコンのシークレットウィンドウで公開URLを開き、そのコードを入れて申請する
5. 最初の端末で、右上のアイコン(赤い点)→「飲み友申請」を承認する
6. 決める →「飲み友と」に切り替えて、相手の店が見えれば完成です

---

## うまくいかないとき

| 表示・症状 | よくある原因 |
|---|---|
| 「この端末だけに保存しています(Firebase が未設定)」 | `firebase-config.js` を貼り付けていない、またはアップロードし忘れている |
| 「サーバーにつながりませんでした」 | 手順2の「匿名」がオンになっていない |
| 「はじめる」を押しても進まない・「保存できませんでした」 | 手順3のデータベース作成、またはルールの「公開」がまだ。ルールが途中で切れていたら丸ごと貼り直す |
| 「Googleでログインできませんでした」 | 手順2の「Google」がオフ、または手順6の承認済みドメインが未登録 |
| 「お店検索のキーが正しくないか、使えない状態です」 | Worker のシークレット `HOTPEPPER_KEY` が未登録・貼り間違い、または公開URLが Worker の `ALLOWED` に入っていない |
| ページが404になる | Pages 設定後、数分待っていない。URLの最後の `/sakabazu/` を確認 |

## ほかの端末で使う

- 今は、端末(ブラウザ)ごとに別のリストになります。別の端末で同じリストを使う方法はまだありません。
- 以前の「招待リンク」「合言葉」でほかの人や端末がリストに入る仕組みは、知らない人に入られる危険があったため廃止しました。

## App Check を設定する(無料枠を荒らされないように・任意)

本物のアプリ(公開ページ)以外からのアクセスを Firebase が弾くようになります。目的・手順・運用は [docs/app-check.md](docs/app-check.md) にまとめています。手順は ますせん の README の「App Check を設定する」と同じです(プロジェクトとキーの名前を `sakabazu` にして、サイトキーを `firebase-config.js` の `APPCHECK_SITE_KEY` に貼る)。

- **サイトキーを入れたファイルをアップロードする前に「適用」すると、アプリが動かなくなります。** 1日ほど使って「確認済みのリクエスト」が増えているのを見てから適用してください。

## ホーム画面に追加する(アプリのように使う)

**iPhone(Safari)**: 共有ボタン(□に↑)→「ホーム画面に追加」
**Android(Chrome)**: 右上の「︙」→「ホーム画面に追加」(または「アプリをインストール」)

- iPhone のホーム画面のアプリは Safari とは別のブラウザ扱いです。Safari で使っていたリストとは別になるので、使う方を1つに決めてください。

## アプリを更新するとき

1. 手元で確認する:`sakabazu` フォルダで `npx http-server -p 8080 -c-1` を動かし、http://localhost:8080 を開く
2. 変えたファイルを GitHub にアップロード(または VS Code でコミットして同期)
3. 1〜2分で公開サイトに反映されます
4. `firestore.rules` を変えたときは、Firebase の「Firestore Database」→「ルール」に貼り直して「公開」も必要です

## 知っておくこと

- 無料の Spark プランで動きます(Firestore は1日あたり読み取り5万回・書き込み2万回まで)。友達同士なら十分です。
- 以前の claude.ai 共有ページ版のデータは移していません。
