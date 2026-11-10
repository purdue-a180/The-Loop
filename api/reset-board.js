import { wrap, send, getUser, kv, listCol, deleteDoc } from "./_lib.js";

// Leadership only: deletes every task, comment, message, meeting item and to-do.
// Accounts, passwords, roles and Duggy outfits are kept.
export default wrap(async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  const me = await getUser(req);
  if (!me || me.role !== "lead") return send(res, 403, { error: "Leadership only." });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (body.confirm !== "RESET") return send(res, 400, { error: "Confirmation missing." });
  const ids = await kv().smembers("users");
  const cols = ["pending", "queue", "lanes/_leads/items"];
  for (const id of ids) cols.push(`lanes/${id}/items`, `lanes/${id}/msgs`, `todos/${id}/items`);
  let n = 0;
  for (const c of cols) for (const d of await listCol(c)) { await deleteDoc(`${c}/${d.id}`); n++; }
  send(res, 200, { deleted: n });
});
