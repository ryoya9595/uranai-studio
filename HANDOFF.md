# 星詠ノ書（体験版占いツール）— 引き継ぎガイド

このリポジトリは **AI占い体験ツール「星詠ノ書（ほしよみ）」** です。
Zoom勉強会などで参加者に配る「体験版プレゼント」として使えます。

- 体験版は **2週間 無料**で占い放題（AIキーは配布者が裏に隠して負担）
- 2週間後は **各自の無料APIキー（Google Gemini）** を登録すれば継続利用できる
- デザイン：墨色の夜空 × アンティークゴールドの和風世界観

> このファイルは、あなた（＝新しい持ち主）の **Claude Code にそのまま渡して**、
> 「このHANDOFF.mdの手順で、私のGitHubに展開して」と頼めば進められるように書いています。

---

## 0. 全体像（3分で分かる仕組み）

```
[利用者のブラウザ]  →  [Cloudflare Worker（あなたのAPIキーを隠して保持）]  →  [Google Gemini]
      ↑ GitHub Pages で公開（無料）              ↑ ここにキーがある。サイトには出ない
```

- **サイト本体**＝GitHub Pages（静的サイト・無料）
- **APIキーの隠し場所**＝Cloudflare Worker（無料）。`worker.js` がそれ
- キーを直接サイトに書くと**丸見え＝悪用・課金リスク**。だからWorkerに隠す
- Workerを立てるまでの間は、サイトは「ローカルの占い文」で動く（壊れない）

---

## 1. 用意するもの（すべて無料）

1. **GitHubアカウント**（サイトの公開先）
2. **Google Gemini APIキー** … https://aistudio.google.com/apikey で発行（`AIza…`）
3. **Cloudflareアカウント** … https://dash.cloudflare.com/sign-up （キーを隠すWorker用）

※ APIキーは **チャットやコードに貼らない**。Cloudflareの管理画面に直接入れます。

---

## 2. 自分のGitHubに展開する

> このフォルダは、お渡しした **`hoshiyomi.zip` を展開したもの**です。
> Zipの置き場所でClaude Codeを開き、「このZipを展開して、中の HANDOFF.md の通りに進めて」と伝えれば、
> 解凍から公開まで進めてくれます（Claude Code は `unzip` で展開できます）。

### Claude Code に頼む場合（推奨・一番早い）
Claude Code に、次のように頼めばOKです（`<あなたのユーザー名>` は自分のGitHubユーザー名に）：

> 「この（展開した）フォルダを私のGitHubアカウントに `hoshiyomi` という名前で公開リポジトリとして作成して、
>  GitHub Pages（mainブランチ / ルート）を有効化して、公開URLを教えて」

Claude Code はだいたい次のコマンド相当を実行します（手動でやる場合の参考）：

```bash
# このフォルダの中で
git init && git add -A && git commit -m "init hoshiyomi"
gh repo create hoshiyomi --public --source=. --push
# GitHub Pages を有効化（mainブランチのルート）
gh api -X POST repos/<あなたのユーザー名>/hoshiyomi/pages -f "source[branch]=main" -f "source[path]=/"
```

数分後、`https://<あなたのユーザー名>.github.io/hoshiyomi/` で開けるようになります。
この時点ではまだ **ローカル占い文**で動きます（AIはこの後つなぎます）。

---

## 3. APIキーを隠す（Cloudflare Worker）

> ### ⚠️ APIキーの扱い（ここだけは必ず守る）
> - **APIキーは、Cloudflareの「Secret」欄にだけ**入れます。
> - **Claude Codeのチャットに貼らない／`config.js` に書かない／GitHubに上げない**。
>   （一度でもコードやチャットに載ると、そこから漏れて悪用・課金の恐れがあります）
> - Claude Codeに渡してよいのは、この後にできる **WorkerのURL** だけ（キーそのものではありません）。
> - Cloudflareへのキー登録・Gemini発行の操作は、**すべてご自身がブラウザ上で**行います。

詳細は同梱の **`PROXY_SETUP.md`** に手順があります。要点だけ：

1. Cloudflareで **Workers & Pages → Create Worker**（名前は `hoshiyomi-proxy` など）
2. **Edit code** を開き、中身を全消しして **`worker.js`** の中身を丸ごと貼り付け → Deploy
3. Workerの **Settings → Variables and Secrets** で登録：
   - `GEMINI_API_KEY`（**Secret**）＝手順1で取ったGeminiキー ← これが肝
   - `ALLOWED_ORIGIN`（Variable・推奨）＝ `https://<あなたのユーザー名>.github.io`
   - `MODEL`（Variable・任意）＝ 既定 `gemini-2.0-flash`
4. WorkerのURL（`https://hoshiyomi-proxy.xxxx.workers.dev`）を控える

---

## 4. サイトとWorkerをつなぐ

`config.js` を開いて、`PROXY_URL` に手順3-4のURLを貼り、pushするだけ：

```js
window.HOSHIYOMI_CONFIG = {
  PROXY_URL: "https://hoshiyomi-proxy.xxxx.workers.dev",  // ← ここに貼る
  MODEL: "gemini-2.0-flash",
  EXPIRED: false,
};
```

Claude Code になら「`config.js` の PROXY_URL にこのURLを入れて push して：<URL>」でOK。
（ここに入れるのは **WorkerのURL** です。APIキーは入れません）
これで体験版が **本物のAI鑑定（Gemini）** に切り替わります。

---

## 5. ウェビナー配布と体験期間（2週間）の運用

- **ウェビナーごとにURL（リポジトリ）を分けて配布**します。各配布は独立した2週間の体験。
  - 例：`hoshiyomi-0720`（7/20開催用）、`hoshiyomi-0803`（8/3開催用）など。
  - 新しいウェビナー版は、Claude Code に「◯月◯日のウェビナー用を新しいURLで作って」と頼めばOK。
- **2週間後の切り替え**は、Claude Code に「◯◯ウェビナー版を終了して」と伝えるだけ。
  Claude Code はその配布の `config.js` を次のように編集して push します：
  1. `EXPIRED: true` … 自前キー未設定の利用者は **`expired.html`（APIの設定案内）** に流れる
  2. `PROXY_URL: ""` … **このツールから、あなたのAPIキー（Worker）への接続を外す**
  - → 体験終了後は、**あなたのAPIキーはこのツールから一切使われません**（コード上もProxyを呼びません）。
  - 開催中の他のウェビナー版が無ければ、Cloudflareの Worker も削除して構いません。
- **自動終了にしたい場合**：その配布の `config.js` に `EXPIRE_DATE: "開催日+14日"`（例 `"2026-07-22"`）を入れておくと、
  その日に自動で体験終了案内へ差し替わります（手動切り替え不要）。
- 終了後、利用者は **`api-setup.html`** から自分のGeminiキーを登録すれば継続利用できます。
- 検証用URL：
  - `?expired=1` … 終了画面をプレビュー（例 `.../hoshiyomi/?expired=1`）
  - `?reset=1` … その端末に保存した自前キーを消去

---

## 6. ファイルの役割

| ファイル | 役割 |
|---|---|
| `index.html` | 占いツール本体（導入→儀式→カード選択→鑑定書） |
| `style.css` | 全体のデザイン |
| `app.js` | 占いロジック＋AI呼び出し＋体験期間ゲート |
| `config.js` | **設定はここだけ**（PROXY_URL / MODEL / EXPIRED / EXPIRE_DATE） |
| `CLAUDE.md` | Claude Code 向けの運用ルール（このZipを渡すと自動で読まれる） |
| `worker.js` | Cloudflare Worker（APIキーを隠す中継役） |
| `expired.html` | 体験終了画面（「APIの設定を行う」へ誘導） |
| `api-setup.html` | 各自のGeminiキー登録ページ |
| `guide.html` | 「AIでツールを作る」紹介ページ（任意） |
| `PROXY_SETUP.md` | Workerデプロイの詳しい手順 |

---

## 7. デプロイ後にやるとよいこと（Claude Codeに頼めばOK）

公開できたら、まず **精度チェック**、その後 **デザイン・機能の調整** を進めるのがおすすめです。
Claude Code からも折を見て提案してくれます。

- **精度チェック**：テスト入力を数パターン占って、鑑定文を確認（名前で呼べているか／断定を避けているか／
  世界観に合うか／長さ・記号）。気になれば `app.js` の `buildReadingPrompt()`（Geminiへの指示文）を調整。
- **文言・タイトル** → `index.html`（体験版の案内文は `.trial-notice` 内）
- **色・デザイン** → `style.css` 冒頭の `:root`（`--gold` などの変数）
- **占うテーマ・カードの意味などの機能** → `app.js`
- ローカル占い文（AI未接続時のフォールバック）→ `app.js` の各テンプレート

※ 変更は「ローカルでプレビュー確認 → 問題なければ push」の順で。

---

## 8. 安全メモ

- APIキーは **Cloudflareのシークレット**にだけ置く。`config.js` やGitHubには**絶対に書かない**。
- 公開URLは誰でも叩けるので、Cloudflareの **Rate limiting**（無料枠）で「1IPあたり毎分◯回」を入れておくと安心。
- Google AI Studio 側でも使用量アラート/上限を設定できます。

困ったら、この `HANDOFF.md` と `PROXY_SETUP.md` を Claude Code に見せて相談してください。
