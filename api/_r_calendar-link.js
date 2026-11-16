import { wrap, send, getUser, kv } from "./_lib.js";
import crypto from "node:crypto";
// GET: return this person's private calendar link (creating it if needed). POST {reset:true}: make a new link and retire the old one.
export default wrap(async (req, res) => {
  const user = await getUser(req);
  if (!user) return send(res, 401, { error: "Not signed in" });
  let token = user.calToken;
  if (!token || (req.method === "POST" && (req.body || {}).reset)) {
    if (token) await kv().del(`caltoken:${token}`);
    token = crypto.randomBytes(24).toString("base64url");
    await kv().set(`caltoken:${token}`, user.id);
    await kv().set(`user:${user.id}`, { ...user, calToken: token });
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  send(res, 200, { url: `https://${host}/api/calendar?t=${token}`, webcal: `webcal://${host}/api/calendar?t=${token}` });
});
