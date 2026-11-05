import { wrap, send, getUser, rateLimit } from "./_lib.js";
const MODELS = { quick: process.env.ANTHROPIC_MODEL_QUICK || "claude-haiku-5-5", default: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5" };
export default wrap(async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const user = await getUser(req);
  if (!user) return send(res, 401, { code: "not_granted", error: "Not signed in" });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { code: "sampling_disabled", error: "AI isn't set up. Add ANTHROPIC_API_KEY in Vercel." });
  if (!(await rateLimit(`ai:${user.id}`, 40, 3600))) return send(res, 429, { code: "rate_limited", error: "Too many requests. Try again later." });
  const { input, tier } = req.body || {};
  const messages = typeof input === "string" ? [{ role: "user", content: input }] : Array.isArray(input) ? input : null;
  if (!messages || JSON.stringify(messages).length > 300_000) return send(res, 400, { code: "prompt_too_large", error: "Input too large." });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELS[tier === "quick" ? "quick" : "default"], max_tokens: 4000, messages }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return send(res, r.status === 429 ? 429 : 502, { code: r.status === 429 ? "rate_limited" : "upstream_error", error: j?.error?.message || "AI request failed." });
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  if (!text.trim()) return send(res, 502, { code: "empty_completion", error: "No answer." });
  send(res, 200, { text, truncated: j.stop_reason === "max_tokens" });
});
