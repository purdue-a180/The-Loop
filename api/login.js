import { wrap, send, findUser, bcrypt, setSession, publicUser, rateLimit, norm } from "./_lib.js";
export default wrap(async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const { username, password } = req.body || {};
  if (!username || !password) return send(res, 400, { error: "Enter your username and password." });
  if (!(await rateLimit(`login:${norm(username)}`, 10, 900))) return send(res, 429, { error: "Too many tries. Wait 15 minutes and try again." });
  const u = await findUser(username);
  if (!u || !(await bcrypt.compare(String(password), u.hash))) return send(res, 401, { error: "That username and password don't match." });
  await setSession(res, u.id);
  send(res, 200, { user: publicUser(u) });
});
