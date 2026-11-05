# Loop

Loop is the exec deliverables tracker for 180 Degrees Consulting Purdue. Directors see only their own action items. The MD and SVP see everyone's progress, get pop-ups when directors complete things, and can turn meeting notes into assigned items.

## Deploy to Vercel (about 10 minutes, free)

1. **Put the code on GitHub.** Create a new **private** repository on github.com. On the empty repo page, click **uploading an existing file**, drag in everything in this folder (`api`, `public`, `scripts`, `package.json`, `vercel.json`, `README.md`, `.gitignore`), and commit.
2. **Create the Vercel project.** On vercel.com, click **Add New → Project**, import that repository, leave the settings as they are (Framework preset: Other), and click **Deploy**. The first deploy will load but won't work yet, because it has no database.
3. **Add the database.** In the project, open **Storage → Create Database → Upstash for Redis** (it's in the Marketplace). Pick the free plan and connect it to this project. Vercel adds the connection details for you.
4. **Add two settings.** Open **Settings → Environment Variables** and add:
   - `SESSION_SECRET`: any long random string, 32 characters or more. It signs everyone's login cookie, so keep it private.
   - `ANTHROPIC_API_KEY` (optional): a key from console.anthropic.com. It turns on "Find action items" for meeting notes and "Write it with Claude" for WhatsApp drafts. Without it, everything else still works. It costs roughly a cent per meeting transcript.
5. **Redeploy.** Open **Deployments**, then on the latest deployment click **⋯ → Redeploy**.
6. Open your site, sign in as `rishi` / `kattunga123`, and change your password from **Settings**.

## Logins

The username is your first name. It ignores case and accents, so `Fabian`, `fabián` and `FABIAN` all work. The starter password is your last name in lowercase plus `123`.

| Person | Username | Starter password | View |
|---|---|---|---|
| Elisah Liban | `elisah` or `liz` | `liban123` | Leadership |
| Rishi Sai Kattunga | `rishi` | `kattunga123` | Leadership |
| Fabián D. Lugo | `fabian` | `lugo123` | Client Acquisition |
| Harishramani Venkatasubramanian | `harishramani` or `harish` | `venkatasubramanian123` | Client Success |
| Devaditya Makhecha | `devaditya` or `dev` | `makhecha123` | Talent Acquisition |
| Anushka Wayse | `anushka` | `wayse123` | Professional Development |
| Alex Okano | `alex` | `okano123` | Marketing |
| Liya Abil | `liya` | `abil123` | Internal Operations |

Anyone can change their password under **Settings**. Until they do, a banner reminds them. The MD or SVP can reset anyone back to their starter password under **Roles and access → Logins**, which also signs that person out everywhere. Since starter passwords are easy to guess, ask everyone to change theirs on day one.

## Changing the board next semester

Edit the `PEOPLE` list at the top of `api/_lib.js` and commit. New people get accounts automatically the next time anyone loads the site. Existing accounts are left alone. Role descriptions (what each director owns and isn't responsible for) can be edited in the app under **Roles and access**.

## Run it on your laptop

```
npm install
npm run dev
```

Then open http://localhost:3000. Local data is kept in memory and resets when you stop the server.

## How it's built

- `public/index.html`: the whole app (one page).
- `api/*.js`: Vercel serverless functions for login, data, passwords and AI.
- Data lives in Upstash Redis. Passwords are hashed with bcrypt, and sessions are signed HTTP-only cookies that last 30 days.
- Access rules are enforced on the server. A director can only read and write their own items. Only the MD and SVP can see other directors' work, change role descriptions or reset passwords.
