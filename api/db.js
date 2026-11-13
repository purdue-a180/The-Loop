import { wrap, send, getUser, checkPath, allowed, readDoc, writeDoc, deleteDoc, listCol, LEAD_IDS } from "./_lib.js";
import { notify } from "./_push.js";
const MAX = 200_000;
export default wrap(async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const user = await getUser(req);
  if (!user) return send(res, 401, { error: "Not signed in" });
  const ops = Array.isArray((req.body || {}).ops) ? req.body.ops.slice(0, 80) : [];
  const out = [];
  const notes = []; // notifications to send once the saves are done
  const short = (s, n = 90) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
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
        // A lead commented or gave kudos on a director's task.
        if (seg[0] === "lanes" && seg[2] === "items" && seg.length === 4) {
          const before = (cur.updates || []).length, added = (next.updates || []).slice(before);
          for (const u of added) if (lead && u.side === "lead" && seg[1] !== user.id)
            notes.push([[seg[1]], u.kudos ? { title: `${user.name} gave you kudos`, body: short(next.title) } : { title: `${user.name} commented on ${short(next.title, 50)}`, body: short(u.text, 160) }]);
          if (!lead && cur.status !== "done" && next.status === "done")
            notes.push([LEAD_IDS, { title: `${user.name} finished a task`, body: short(next.title) }]);
        }
        // Liz or Rishi finished a task the other one gave them.
        if (seg[0] === "between" && seg.length === 4 && !cur.done && next.done && cur.by && cur.by !== user.id)
          notes.push([[cur.by], { title: `${user.name} finished a task you gave them`, body: short(next.title) }]);
        if (seg[0] === "between" && seg.length === 4) {
          const added = (next.updates || []).slice((cur.updates || []).length).filter((u) => u.by === user.id);
          const other = LEAD_IDS.find((x) => x !== user.id);
          for (const u of added) if (other) notes.push([[other], { title: `${user.name} posted an update on ${short(next.title, 50)}`, body: short(u.text, 160) }]);
          if (cur.status !== "blocked" && next.status === "blocked" && cur.by && cur.by !== user.id)
            notes.push([[cur.by], { title: `${user.name} is blocked on a task`, body: short(next.title) }]);
        }
      }
      else if (o.op === "delete") {
        await deleteDoc(o.path); out.push({ ok: true });
      }
      else if (o.op === "add") {
        const id = (o.id && /^[A-Za-z0-9_-]{6,40}$/.test(o.id)) ? o.id : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        await writeDoc(`${o.path}/${id}`, o.data || {}); out.push({ ok: true, id });
        const d = o.data || {};
        if (seg[0] === "lanes" && seg[2] === "items" && lead && seg[1] !== user.id)
          notes.push([[seg[1]], { title: `${user.name} assigned you a task`, body: short(d.title) }]);
        if (seg[0] === "lanes" && seg[2] === "msgs") {
          if (lead && seg[1] !== user.id) notes.push([[seg[1]], { title: `${user.name} sent you a message`, body: short(d.text, 160) }]);
          else if (!lead) notes.push([LEAD_IDS, { title: `${user.name} sent a message`, body: short(d.text, 160) }]);
        }
        if (seg[0] === "between" && d.to && d.to !== user.id && LEAD_IDS.includes(d.to))
          notes.push([[d.to], { title: `${user.name} added a task for you`, body: short(d.title) }]);
      }
      else out.push({ error: "invalid_argument" });
    } catch (e) { out.push({ error: "unavailable", message: e.message }); }
  }
  if (notes.length) await Promise.allSettled(notes.map(([to, m]) => notify(to.filter((x) => x !== user.id), m)));
  send(res, 200, { results: out, at: Date.now() });
});
