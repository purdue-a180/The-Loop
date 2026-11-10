import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

/* ---------- storage: Upstash Redis on Vercel, in-memory for local testing ---------- */
const mem = new Map();
const memStore = {
  async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; },
  async set(k, v) { mem.set(k, JSON.stringify(v)); return "OK"; },
  async del(...ks) { ks.forEach((k) => mem.delete(k)); return ks.length; },
  async mget(...ks) { return ks.map((k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null)); },
  async sadd(k, ...m) { const s = new Set((await this.get(k)) || []); m.forEach((x) => s.add(x)); mem.set(k, JSON.stringify([...s])); return m.length; },
  async srem(k, ...m) { const s = new Set((await this.get(k)) || []); m.forEach((x) => s.delete(x)); mem.set(k, JSON.stringify([...s])); return m.length; },
  async smembers(k) { return (await this.get(k)) || []; },
  async incr(k) { const v = ((await this.get(k)) || 0) + 1; mem.set(k, JSON.stringify(v)); return v; },
  async expire() { return 1; },
};
let store;
export function kv() {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) store = new Redis({ url, token });
  else if (process.env.VERCEL) throw Object.assign(new Error("No database connected. Add Upstash Redis to this Vercel project (see README)."), { status: 500 });
  else store = memStore;
  return store;
}

/* ---------- people ---------- */
export const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const PEOPLE = [
  { id: "elisah", name: "Liz", fullName: "Elisah Liban", last: "liban", aliases: ["elisah", "liz"], role: "lead", title: "Managing Director" },
  { id: "rishi", name: "Rishi", fullName: "Rishi Sai Kattunga", last: "kattunga", aliases: ["rishi"], role: "lead", title: "Senior Vice President" },
  { id: "fabian", name: "Fabián", fullName: "Fabián D. Lugo", last: "lugo", aliases: ["fabian"], role: "director", lane: "acquisition" },
  { id: "harish", name: "Harish", fullName: "Harishramani Venkatasubramanian", last: "venkatasubramanian", aliases: ["harishramani", "harish"], role: "director", lane: "success" },
  { id: "devaditya", name: "Devaditya", fullName: "Devaditya Makhecha", last: "makhecha", aliases: ["devaditya", "dev"], role: "director", lane: "recruitment" },
  { id: "anushka", name: "Anushka", fullName: "Anushka Wayse", last: "wayse", aliases: ["anushka"], role: "director", lane: "profdev" },
  { id: "alex", name: "Alex", fullName: "Alex Okano", last: "okano", aliases: ["alex"], role: "director", lane: "marketing" },
  { id: "liya", name: "Liya", fullName: "Liya Abil", last: "abil", aliases: ["liya"], role: "director", lane: "ops" },
];
export const starterPassword = (u) => `${u.last}123`;

export async function ensureSeed() {
  const db = kv();
  const want = PEOPLE.map((p) => p.id).join(",");
  if ((await db.get("meta:seeded")) === want) return;
  // Adds anyone in PEOPLE who doesn't have an account yet. Existing accounts and passwords are left alone.
  for (const p of PEOPLE) {
    if (await db.get(`user:${p.id}`)) continue;
    const hash = await bcrypt.hash(starterPassword(p), 10);
    await db.set(`user:${p.id}`, { ...p, hash, starter: true });
    for (const a of p.aliases) await db.set(`alias:${norm(a)}`, p.id);
    await db.sadd("users", p.id);
    if (p.role === "director" && !(await readDoc(`lanes/${p.id}`))) await writeDoc(`lanes/${p.id}`, { role: p.lane, name: p.name, claimedAt: new Date().toISOString() });
  }
  await db.set("meta:seeded", want);
}
export async function findUser(username) {
  const id = await kv().get(`alias:${norm(username)}`);
  return id ? kv().get(`user:${id}`) : null;
}
export const publicUser = (u) => ({ id: u.id, name: u.name, fullName: u.fullName, role: u.role, lane: u.lane || null, title: u.title || null, starter: !!u.starter });

/* ---------- sessions ---------- */
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.VERCEL) throw Object.assign(new Error("SESSION_SECRET is not set (see README)."), { status: 500 });
  return new TextEncoder().encode(s || "local-dev-secret-change-me");
};
const COOKIE = "tracker_session";
export async function setSession(res, id) {
  const jwt = await new SignJWT({ sub: id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${jwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`);
}
export function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
export async function getUser(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw.slice(COOKIE.length + 1), secret());
    const u = await kv().get(`user:${payload.sub}`);
    if (!u || (u.pwAt && payload.iat * 1000 < u.pwAt - 1000)) return null;
    return u;
  } catch { return null; }
}

/* ---------- documents ---------- */
const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
export function checkPath(path, wantDoc) {
  const seg = String(path || "").split("/");
  if (!seg.every((s) => SEG.test(s) && s !== "." && s !== "..")) return null;
  if (wantDoc !== undefined && (seg.length % 2 === 0) !== wantDoc) return null;
  return seg;
}
export async function readDoc(path) { const d = await kv().get(`d:${path}`); return d ? d.data : null; }
export async function writeDoc(path, data) {
  const seg = path.split("/"), col = seg.slice(0, -1).join("/"), id = seg[seg.length - 1];
  await kv().set(`d:${path}`, { data, at: Date.now() });
  await kv().sadd(`c:${col}`, id);
}
export async function deleteDoc(path) {
  const seg = path.split("/"), col = seg.slice(0, -1).join("/"), id = seg[seg.length - 1];
  await kv().del(`d:${path}`);
  await kv().srem(`c:${col}`, id);
}
export async function listCol(path) {
  const ids = await kv().smembers(`c:${path}`);
  if (!ids.length) return [];
  const docs = await kv().mget(...ids.map((id) => `d:${path}/${id}`));
  return ids.map((id, i) => (docs[i] ? { id, data: docs[i].data } : null)).filter(Boolean);
}

/* Who may read or write what. Leads (MD, SVP) see everything; directors see only their own lane. */
export function allowed(user, seg, write) {
  const lead = user.role === "lead";
  if (seg[0] === "config") return write ? lead : true;
  if (seg[0] === "pending" || seg[0] === "queue") return lead;
  // Each leader's private to-do list: only that leader can read or write it.
  if (seg[0] === "todos") return lead && seg[1] === user.id;
  if (seg[0] === "lanes") {
    if (seg.length === 1) return lead && !write;
    return lead || seg[1] === user.id;
  }
  return false;
}

/* ---------- http helpers ---------- */
export function send(res, status, body) { res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(body)); }
export function wrap(fn) {
  return async (req, res) => {
    try { await ensureSeed(); await fn(req, res); }
    catch (e) { send(res, e.status || 500, { error: e.message || "Server error" }); }
  };
}
export async function rateLimit(key, max, seconds) {
  const n = await kv().incr(`rl:${key}`);
  if (n === 1) await kv().expire(`rl:${key}`, seconds);
  return n <= max;
}
export { bcrypt };
