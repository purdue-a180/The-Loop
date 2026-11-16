import { wrap, send, getUser, kv, publicUser } from "./_lib.js";
export default wrap(async (req, res) => {
  const me = await getUser(req);
  if (!me || me.role !== "lead") return send(res, 403, { error: "Leadership only." });
  const ids = await kv().smembers("users");
  const users = (await Promise.all(ids.map((id) => kv().get(`user:${id}`)))).filter(Boolean).map(publicUser);
  send(res, 200, { users });
});
