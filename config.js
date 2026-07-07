/* ============================================================
   星詠ノ書 — 設定ファイル（ここだけ書き換えればOK）
   ============================================================ */
window.HOSHIYOMI_CONFIG = {
  /* Cloudflare Worker（Proxy）のURL。
     Workerをデプロイしたら、その公開URLをここに貼る。
     例: "https://hoshiyomi-proxy.xxxx.workers.dev"
     空のままなら、体験版はローカル鑑定文で動作する（APIは呼ばない）。 */
  PROXY_URL: "",

  /* 使用するGeminiモデル（安価で高速な flash 系を推奨） */
  MODEL: "gemini-2.0-flash",

  /* 体験期間の終了スイッチ。
     true にすると、自前APIキー未設定の人は expired.html（APIの設定案内）へ誘導される。
     ※2週間後に、この値を true に変えるだけで一斉に切り替わる。 */
  EXPIRED: false,
};
