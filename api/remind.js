// Daily deadline reminders, run by a Vercel cron each morning.
// Sends each person a heads-up for tasks due today or tomorrow, and one nudge the day after something slips.
import { wrap, send, listCol, kv, ALL_IDS, LEAD_IDS } from "./_lib.js";
import { notify } from "./_push.js";

const tz = "America/Indiana/Indianapolis";
const dayStr = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const short = (s, n = 90) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

export default wrap(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const ok = secret ? req.headers.authorization === `Bearer ${secret}` : /vercel-cron/i.test(req.headers["user-agent"] || "");
  if (!ok) return send(res, 401, { error: "Only the scheduled job can run this." });

  const now = new Date(), today = dayStr(now), tomorrow = dayStr(new Date(now.getTime() + 864e5)), yesterday = dayStr(new Date(now.getTime() - 864e5));
  const plan = []; // [uid, task title, when, key]
  const add = (to, title, due, key) => {
    if (due === today) plan.push([to, title, "today", key]);
    else if (due === tomorrow) plan.push([to, title, "tomorrow", key]);
    else if (due === yesterday) plan.push([to, title, "late", key]);
  };
  for (const id of ALL_IDS) {
    for (const { id: tid, data } of await listCol(`lanes/${id}/items`))
      if (data.status !== "done" && data.due) add(id, data.title, data.due, `lanes/${id}/${tid}`);
  }
  for (const { id: tid, data } of await listCol("between/leads/items"))
    if (!data.done && data.due && LEAD_IDS.includes(data.to)) add(data.to, data.title, data.due, `between/${tid}`);

  let sent = 0;
  for (const [to, title, when, key] of plan) {
    const k = `remind:${key}:${today}`;
    if (!(await kv().set(k, 1, { nx: true, ex: 60 * 60 * 36 }))) continue; // already reminded today
    const m = when === "today" ? { title: "Due today", body: `${short(title)} is due today. You've got this.` }
      : when === "tomorrow" ? { title: "Due tomorrow", body: `Heads up: ${short(title)} is due tomorrow.` }
      : { title: "This slipped past its date", body: `${short(title)} was due yesterday. Post a quick update or move the date.` };
    await notify([to], { ...m, tag: key });
    sent++;
  }
  send(res, 200, { checked: plan.length, sent });
});
