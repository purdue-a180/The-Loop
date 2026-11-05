import { wrap, send, getUser, bcrypt, kv, starterPassword } from "./_lib.js";
export default wrap(async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const me = await getUser(req);
  if (!me || me.role !== "lead") return send(res, 403, { error: "Only the MD or SVP can reset passwords." });
  const target = await kv().get(`user:${String((req.body || {}).userId || "")}`);
  if (!target) return send(res, 404, { error: "No such person." });
  await kv().set(`user:${target.id}`, { ...target, hash: await bcrypt.hash(starterPassword(target), 10), starter: true, pwAt: Date.now() });
  send(res, 200, { ok: true });
});
