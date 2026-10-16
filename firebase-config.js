// Firebase の設定。README.md の「4. 設定をコピーする」で表示される
// firebaseConfig の中身を、下の {} の中にそのまま貼り付けてください。
// この値は公開しても問題ありません(データは firestore.rules で守ります)。
// 空のままなら、記録はこの端末だけに保存されます(グループ機能は使えません)。
window.FIREBASE_CONFIG = {
};

// App Check(本物のアプリ以外からのアクセスを防ぐ)の reCAPTCHA Enterprise のキー(サイトキー)。
// README.md の「App Check を設定する」で作ったキーを "" の中に貼り付けてください。空のままなら使いません。
window.APPCHECK_SITE_KEY = "";

// ホットペッパー グルメサーチAPI のキー。README.md の「ホットペッパーのAPIキー」で取得して貼り付けてください。
// 空のままなら「探」ボタンは Googleマップ検索へのリンクだけになります。
window.HOTPEPPER_KEY = "";
