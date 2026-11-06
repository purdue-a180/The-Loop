import { wrap, kv, listCol } from "./_lib.js";

const TITLES = { acquisition: "Client Acquisition", success: "Client Success", recruitment: "Talent Acquisition", profdev: "Professional Development", marketing: "Marketing", ops: "Internal Operations" };
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line) => { const out = []; let s = line; while (Buffer.byteLength(s) > 74) { let n = 74; while (Buffer.byteLength(s.slice(0, n)) > 74) n--; out.push(s.slice(0, n)); s = " " + s.slice(n); } out.push(s); return out.join("\r\n"); };
const ymd = (iso) => iso.replace(/-/g, "");
const nextDay = (iso) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

// Subscribable calendar feed: /api/calendar?t=<secret>. Google Calendar polls it, so deadlines appear and update without anyone re-adding them.
export default wrap(async (req, res) => {
  const t = String((req.query && req.query.t) || new URL(req.url, "http://x").searchParams.get("t") || "");
  const uid = /^[A-Za-z0-9_-]{20,80}$/.test(t) ? await kv().get(`caltoken:${t}`) : null;
  const user = uid ? await kv().get(`user:${uid}`) : null;
  if (!user || user.calToken !== t) { res.status(404).send("Calendar not found"); return; }
  const host = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const lanes = user.role === "lead" ? (await listCol("lanes")).filter((l) => l.data && l.data.role) : [{ id: user.id, data: (await kv().get(`d:lanes/${user.id}`))?.data || {} }];
  const events = [];
  for (const lane of lanes) {
    const items = await listCol(`lanes/${lane.id}/items`);
    for (const { id, data: it } of items) {
      if (!it || !/^\d{4}-\d{2}-\d{2}$/.test(it.due || "")) continue;
      const done = it.status === "done";
      const who = user.role === "lead" ? `[${TITLES[lane.data.role] || "Director"}${lane.data.name ? " · " + lane.data.name : ""}] ` : "";
      const desc = [it.detail ? `Note: ${it.detail}` : "", it.quote ? `From the meeting: "${it.quote}"` : "", `Open loop: ${host}`].filter(Boolean).join("\n\n");
      events.push([
        "BEGIN:VEVENT", `UID:${id}@the-loop`, `DTSTAMP:${stamp()}`,
        `DTSTART;VALUE=DATE:${ymd(it.due)}`, `DTEND;VALUE=DATE:${nextDay(it.due)}`,
        `SUMMARY:${esc((done ? "✓ " : "") + who + it.title)}`, `DESCRIPTION:${esc(desc)}`, `URL:${host}`,
        "STATUS:CONFIRMED", "TRANSP:TRANSPARENT",
        ...(done ? [] : ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(it.title)} is due today`, "TRIGGER:PT9H", "END:VALARM"]),
        "END:VEVENT",
      ].map(fold).join("\r\n"));
    }
  }
  const name = user.role === "lead" ? "loop · All directors" : `loop · ${user.name}`;
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//180DC Purdue//loop//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${esc(name)}`), "X-WR-TIMEZONE:America/Indiana/Indianapolis", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    ...events, "END:VCALENDAR"].join("\r\n") + "\r\n";
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(body);
});
