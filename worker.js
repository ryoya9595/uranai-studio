/* ============================================================
   星詠ノ書 — Gemini Proxy（Cloudflare Worker）
   役割：APIキーをサーバー側に隠したまま Gemini を呼ぶ中継役。
   サイト（GitHub Pages）からは {prompt} だけを受け取り、
   キー（env.GEMINI_API_KEY）はここにしか存在しない＝ユーザーに見えない。

   デプロイ手順は PROXY_SETUP.md を参照。
   必要なシークレット/変数：
     - GEMINI_API_KEY（必須・Secret）… Google AI Studio で取得したキー
     - MODEL（任意・Variable）… 既定 "gemini-2.0-flash"
   ============================================================ */

const ALLOWED_ORIGIN = "https://ryoya9595.github.io"; // 配布サイトのオリジン
const MAX_PROMPT = 6000;   // 過大リクエスト防止
const MAX_TOKENS = 1400;   // 1回あたりの出力上限（コスト保険）

const READING_SCHEMA = {
  type: "object",
  properties: {
    empathy:   { type: "string" },
    analysis:  { type: "string" },
    tarotText: { type: "string" },
    guidance:  { type: "string" },
    closing:   { type: "string" },
    oracle:    { type: "string" },
  },
  required: ["empathy", "analysis", "tarotText", "guidance", "closing"],
};

function cors(extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  }, extra || {});
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: cors({ "Content-Type": "application/json" }),
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    if (request.method !== "POST") return new Response("Hoshiyomi proxy is running.", { headers: cors() });

    // オリジン制限（配布サイト以外からの呼び出しをブロック）
    const origin = request.headers.get("Origin") || "";
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "forbidden" }, 403);

    if (!env.GEMINI_API_KEY) return json({ error: "server not configured" }, 500);

    let prompt = "";
    try { prompt = (await request.json()).prompt || ""; } catch (_) {}
    if (!prompt || prompt.length > MAX_PROMPT) return json({ error: "bad request" }, 400);

    const model = env.MODEL || "gemini-2.0-flash";
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.05,
        maxOutputTokens: MAX_TOKENS,
        responseMimeType: "application/json",
        responseSchema: READING_SCHEMA,
      },
    };

    try {
      const gres = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + env.GEMINI_API_KEY,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      const data = await gres.json();
      if (!gres.ok) return json({ error: "gemini error", detail: data && data.error && data.error.message }, 502);
      const text = data && data.candidates && data.candidates[0] &&
        data.candidates[0].content && data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text || "";
      return json({ text });
    } catch (e) {
      return json({ error: "upstream failure" }, 502);
    }
  },
};
