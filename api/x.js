// One server function for the small account and settings actions, so the app stays within
// Vercel's free-plan limit of 12 functions. vercel.json points the old addresses here.
import logout from "./_r_logout.js";
import me from "./_r_me.js";
import password from "./_r_password.js";
import resetPassword from "./_r_reset-password.js";
import people from "./_r_people.js";
import resetBoard from "./_r_reset-board.js";
import push from "./_r_push.js";
import calendarLink from "./_r_calendar-link.js";

const routes = { logout, me, password, "reset-password": resetPassword, people, "reset-board": resetBoard, push, "calendar-link": calendarLink };

export default async function handler(req, res) {
  const u = new URL(req.url, "http://x");
  let name = (req.query && req.query.route) || u.searchParams.get("route");
  if (!name) { const last = u.pathname.split("/").filter(Boolean).pop(); if (routes[last]) name = last; }
  const h = routes[name];
  if (!h) { res.statusCode = 404; res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ error: "Not found" })); }
  return h(req, res);
}
