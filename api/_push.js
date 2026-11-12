// Phone and desktop notifications (Web Push). Keys are created once and kept in the database,
// so there is nothing to set up in Vercel.
import webpush from "web-push";
import { kv } from "./_lib.js";

let ready = null;
export async function vapid() {
  if (ready) return ready;
  let keys = await kv().get("meta:vapid");
  if (!keys || !keys.publicKey) {
    keys = webpush.generateVAPIDKeys();
    await kv().set("meta:vapid", keys);
  }
  webpush.setVapidDetails("https://loop-neon-mu.vercel.app", keys.publicKey, keys.privateKey);
  ready = keys;
  return keys;
}

export async function saveSub(uid, sub) {
  if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint) || !sub.keys) return false;
  const clean = JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh || ""), auth: String(sub.keys.auth || "") } });
  await dropSub(uid, sub.endpoint);
  await kv().sadd(`push:${uid}`, clean);
  return true;
}
export async function dropSub(uid, endpoint) {
  const all = await kv().smembers(`push:${uid}`);
  for (const s of all) {
    const o = typeof s === "string" ? JSON.parse(s) : s;
    if (o.endpoint === endpoint) await kv().srem(`push:${uid}`, typeof s === "string" ? s : JSON.stringify(s));
  }
}

/* Send one notification to each person in uids. Never throws: a failed notification must not fail a save. */
export async function notify(uids, msg) {
  try {
    await vapid();
    const payload = JSON.stringify({ title: msg.title, body: (msg.body || "").slice(0, 180), url: msg.url || "/", tag: msg.tag || undefined });
    const jobs = [];
    for (const uid of [...new Set(uids)]) {
      const subs = await kv().smembers(`push:${uid}`);
      for (const s of subs) {
        const raw = typeof s === "string" ? s : JSON.stringify(s);
        const sub = JSON.parse(raw);
        jobs.push(
          webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24, urgency: "high", timeout: 5000 })
            .catch(async (e) => { if (e.statusCode === 404 || e.statusCode === 410) await kv().srem(`push:${uid}`, raw); })
        );
      }
    }
    await Promise.allSettled(jobs);
  } catch (e) { console.error("notify", e.message); }
}
