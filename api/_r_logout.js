import { wrap, send, clearSession } from "./_lib.js";
export default wrap(async (req, res) => { clearSession(res); send(res, 200, { ok: true }); });
