import { wrap, send, getUser } from "./_lib.js";
import { vapid, saveSub, dropSub, notify } from "./_push.js";

export default wrap(async (req, res) => {
  const me = await getUser(req);
  if (!me) return send(res, 401, { error: "Not signed in" });
  if (req.method === "GET") return send(res, 200, { key: (await vapid()).publicKey });
  if (req.method !== "POST") return send(res, 405, { error: "Use GET or POST" });
  const b = req.body || {};
  if (b.unsubscribe) { await dropSub(me.id, String(b.unsubscribe)); return send(res, 200, { ok: true }); }
  if (b.test) { await notify([me.id], { title: "Notifications are on", body: "You'll hear from loop when something comes in for you.", tag: "test" }); return send(res, 200, { ok: true }); }
  if (!(await saveSub(me.id, b.subscription))) return send(res, 400, { error: "That subscription didn't look right." });
  send(res, 200, { ok: true });
});
