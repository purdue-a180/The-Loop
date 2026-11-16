import { wrap, send, getUser, bcrypt, kv, setSession, rateLimit } from "./_lib.js";
export default wrap(async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const u = await getUser(req);
  if (!u) return send(res, 401, { error: "Not signed in" });
  const { current, next } = req.body || {};
  if (!(await rateLimit(`pw:${u.id}`, 10, 900))) return send(res, 429, { error: "Too many tries. Wait 15 minutes." });
  if (!(await bcrypt.compare(String(current || ""), u.hash))) return send(res, 400, { error: "Your current password isn't right." });
  if (String(next || "").length < 8) return send(res, 400, { error: "Use at least 8 characters." });
  const pwAt = Date.now();
  await kv().set(`user:${u.id}`, { ...u, hash: await bcrypt.hash(String(next), 10), starter: false, pwAt });
  await setSession(res, u.id);
  send(res, 200, { ok: true });
});
