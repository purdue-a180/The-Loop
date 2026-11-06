import { wrap, send, getUser, checkPath, allowed, readDoc, writeDoc, deleteDoc, listCol } from "./_lib.js";
const MAX = 200_000;
export default wrap(async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const user = await getUser(req);
  if (!user) return send(res, 401, { error: "Not signed in" });
  const ops = Array.isArray((req.body || {}).ops) ? req.body.ops.slice(0, 80) : [];
  const out = [];
  for (const o of ops) {
    try {
      const isCol = o.op === "list" || o.op === "add";
      const seg = checkPath(o.path, !isCol);
      if (!seg) { out.push({ error: "invalid_argument" }); continue; }
      const write = !["get", "list"].includes(o.op);
      if (!allowed(user, seg, write)) { out.push(write ? { error: "invalid_argument" } : (isCol ? { docs: [] } : { data: null })); continue; }
      if (write && JSON.stringify(o.data || {}).length > MAX) { out.push({ error: "invalid_argument" }); continue; }
      const lead = user.role === "lead";
      // Directors may only rename themselves on their own lane document, never change their role.
      if (write && seg[0] === "lanes" && seg.length === 2 && !lead) {
        if (o.op !== "update") { out.push({ error: "invalid_argument" }); continue; }
        // Directors may rename themselves and dress up their Duggy; nothing else on the lane document.
        const next = {};
        if (typeof o.data?.name === "string" && o.data.name.trim()) next.name = o.data.name.trim().slice(0, 60);
        if (o.data?.duggy && typeof o.data.duggy === "object") {
          const ok = (v) => (typeof v === "string" && /^[a-z]{0,12}$/.test(v) ? v : "");
          next.duggy = { specs: ok(o.data.duggy.specs), hat: ok(o.data.duggy.hat), hold: ok(o.data.duggy.hold) };
        }
        o.data = next;
      }
      if (o.op === "get") out.push({ data: await readDoc(o.path) });
      else if (o.op === "list") out.push({ docs: await listCol(o.path) });
      else if (o.op === "set") { await writeDoc(o.path, o.data || {}); out.push({ ok: true }); }
      else if (o.op === "update") {
        const cur = await readDoc(o.path);
        if (!cur) { out.push({ error: "invalid_argument" }); continue; }
        const next = { ...cur, ...(o.data || {}) };
        await writeDoc(o.path, next); out.push({ ok: true });
      }
      else if (o.op === "delete") {
        await deleteDoc(o.path); out.push({ ok: true });
      }
      else if (o.op === "add") {
        const id = (o.id && /^[A-Za-z0-9_-]{6,40}$/.test(o.id)) ? o.id : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        await writeDoc(`${o.path}/${id}`, o.data || {}); out.push({ ok: true, id });
      }
      else out.push({ error: "invalid_argument" });
    } catch (e) { out.push({ error: "unavailable", message: e.message }); }
  }
  send(res, 200, { results: out, at: Date.now() });
});
