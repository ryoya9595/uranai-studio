# 星詠ノ書 — Gemini Proxy デプロイ手順（りょうや用）

APIキーを**サイトから見えないように隠す**ための中継サーバー（Cloudflare Worker）を立てる手順。
CLIは不要。すべてブラウザのダッシュボードだけで完結する。所要 5〜10分・無料。

---

## 0. 事前準備：Gemini APIキーを取得
1. https://aistudio.google.com/apikey を開き、Googleでログイン
2. 「Create API key」→ キーをコピー（`AIza…` で始まる文字列）
   - ※このキーは**チャットに貼らない**。次のステップでCloudflareに直接入れる。

## 1. Cloudflareアカウント作成（無料）
- https://dash.cloudflare.com/sign-up で登録（クレカ不要）

## 2. Workerを作る
1. ダッシュボード左メニュー **Workers & Pages** → **Create application** → **Create Worker**
2. 名前を `hoshiyomi-proxy` などにして **Deploy**
3. デプロイ後、**Edit code** を開く
4. エディタの中身を全部消して、リポジトリの **`worker.js`** の中身を丸ごと貼り付け → **Deploy**

## 3. APIキーを「Secret」として登録（←ここが肝）
1. そのWorkerの **Settings** → **Variables and Secrets**
2. **Add** で以下を登録：
   - `GEMINI_API_KEY` … 種別 **Secret（暗号化）** に、手順0でコピーしたキーを貼る
   - `MODEL` … 種別 Variable（任意）。既定で `gemini-2.0-flash`。変えたい時だけ
3. **Save / Deploy**
   - Secretにすると値は二度と表示されず、コードにもサイトにも残らない＝**キーは完全非公開**。

## 4. WorkerのURLを控える
- Workerの概要ページに `https://hoshiyomi-proxy.<あなたのサブドメイン>.workers.dev` が出る。これをコピー。

## 5. サイト側に反映（Claude Codeに依頼でOK）
- `config.js` の `PROXY_URL` に手順4のURLを貼って push すれば、体験版がGemini鑑定に切り替わる。
- 「このURLをPROXY_URLに入れて公開して：<URL>」とClaude Codeに渡せば反映する。

---

## 動作の考え方
- サイト（GitHub Pages）→ **Worker**（キーを保持）→ Gemini、という流れ。
- ブラウザのソースや通信ログには **Workerのアドレスしか出ない**。キーはWorkerの中だけ。

## 悪用・コスト対策（任意で強化可）
- 既定で「配布サイト以外からの呼び出しを拒否」＋「1回の出力トークン上限」を入れてある。
- さらに絞るなら、Cloudflareの **Rate limiting rules**（無料枠あり）でWorkerに「1IPあたり毎分◯回まで」を設定できる。
- 心配なら Google AI Studio 側で**使用量アラート/上限**も設定しておくと安心。

## 2週間後（体験終了）にすること
1. `config.js` の `EXPIRED` を `true` にして push（Claude Codeに「終了して」と言えばOK）
   → 自前キー未設定の人は `expired.html`（APIの設定案内）に自動で流れる。
2. 必要なら、このWorkerを削除 or 一時停止してもよい（自前キー勢は各自のキーで動くので影響なし）。
