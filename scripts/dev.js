// Local test server: node scripts/dev.js  -> http://localhost:3000 (in-memory data, resets on restart)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".js": "text/javascript", ".webmanifest": "application/manifest+json" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const file = path.join(root, "api", url.pathname.slice(5) + ".js");
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    let raw = ""; for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = (n) => { res.statusCode = n; return res; };
    res.send = (b) => res.end(b);
    const mod = await import(pathToFileURL(file).href);
    return mod.default(req, res);
  }
  const f = path.join(root, "public", url.pathname === "/" ? "index.html" : url.pathname);
  if (!f.startsWith(path.join(root, "public")) || !fs.existsSync(f)) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
