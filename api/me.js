import { wrap, send, getUser, publicUser } from "./_lib.js";
export default wrap(async (req, res) => {
  const u = await getUser(req);
  if (!u) return send(res, 401, { error: "Not signed in" });
  send(res, 200, { user: publicUser(u), ai: !!process.env.ANTHROPIC_API_KEY });
});
