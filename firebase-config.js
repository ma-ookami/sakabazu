// Firebase の設定。README.md の「4. 設定をコピーする」で表示される
// firebaseConfig の中身を、下の {} の中にそのまま貼り付けてください。
// この値は公開しても問題ありません(データは firestore.rules で守ります)。
// 空のままなら、記録はこの端末だけに保存されます(グループ機能は使えません)。
window.FIREBASE_CONFIG = {
        apiKey: "AIzaSyDWN7YFaE0_UOtvp17wwX9FjrPTxY1_qX4",
    authDomain: "sakabazu.firebaseapp.com",
    projectId: "sakabazu",
    storageBucket: "sakabazu.firebasestorage.app",
    messagingSenderId: "775299935947",
    appId: "1:775299935947:web:b4b16acda8cc3a4600b54e"
};

// App Check(本物のアプリ以外からのアクセスを防ぐ)の reCAPTCHA Enterprise のキー(サイトキー)。
// README.md の「App Check を設定する」で作ったキーを "" の中に貼り付けてください。空のままなら使いません。
window.APPCHECK_SITE_KEY = "";

// ホットペッパー検索の中継(Cloudflare Worker)のURL。README.md の「ホットペッパー検索の中継を作る」で作ったURLを貼り付けてください。
// APIキーそのものはここに書かないでください(Worker 側に保存します)。
// 空のままなら「探」ボタンは Googleマップ検索へのリンクだけになります。
window.HOTPEPPER_PROXY = "https://sakabazu-hp.masaya-okami.workers.dev/";
