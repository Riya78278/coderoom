# CodeRoom — Deployment Guide (Phase 7)

Goal: a public URL like `https://coderoom-xxxx.onrender.com` you can share.

**Architecture reminder:** Neon Postgres (free, doesn't expire) holds the data;
Render (free tier) runs the app. We use a **custom Node server** (`server.mjs`)
so WebSockets work — that's why we deploy on Render and not Vercel.

---

## What you need (one-time, only you can do these)

1. A **GitHub account** — https://github.com/signup
2. A **Render account** — https://render.com → "Sign in with GitHub" (easiest)

---

## Step A — Create the GitHub repo

1. Go to https://github.com/new
2. Repository name: `coderoom`
3. Visibility: **Private** is fine (nobody sees your code; deployment works the same)
4. **Leave every checkbox unchecked** (no README, no .gitignore, no license — we already have ours)
5. Click **Create repository** — do NOT follow GitHub's copy-paste commands yet; use Step B instead.

---

## Step B — Push the project from your Mac

⚠️ **Git note:** the system `git` on this Mac is currently broken (it's the Xcode
placeholder). Use Homebrew's git by prefixing commands with
`export PATH="/opt/homebrew/bin:$PATH"`, or fix it permanently:

```bash
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Then, from the project folder (`collaborative coding platform project`):

```bash
git init
git add .
git commit -m "CodeRoom: phases 1-6 (auth, rooms, editor, real-time, interviews, execution)"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/coderoom.git
git push -u origin main
```

(GitHub will ask you to log in — use "Sign in with browser".)

**Safety check before pushing:** `.env` and `.env.save` must NOT be uploaded.
Verify with:

```bash
git ls-files | grep -E "^\.env"
# should print only: .env.example
```

---

## Step C — Create the Render web service

1. Go to https://dashboard.render.com → **New +** → **Web Service**
2. Connect your `coderoom` GitHub repo (first time: authorize Render)
3. Fill in:
   - **Name:** `coderoom` (the URL becomes `https://coderoom.onrender.com` or similar)
   - **Region:** choose the one closest to you (e.g. Singapore for India)
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:**
     ```
     npm install && npx prisma generate && npx prisma migrate deploy && npm run build
     ```
   - **Start Command:**
     ```
     npm start
     ```
   - **Instance Type:** Free
4. Open **Advanced → Add Environment Variable** and add these four:

   | Key | Value |
   |---|---|
   | `NODE_VERSION` | `22` |
   | `DATABASE_URL` | *(your real Neon connection string — same one as your local `.env`)* |
   | `AUTH_SECRET` | *(new long random string — see below)* |
   | `INTERNAL_BROADCAST_SECRET` | *(new long random string — see below)* |

   Generate the two secrets in your terminal:
   ```bash
   openssl rand -base64 32
   ```
   (run it twice — one for each). Don't reuse your local one; production
   sessions should have their own signing key.

   ⚠️ The Neon connection string must be the **pooled** one (contains
   `-pooler` in the host) — Neon marks it "pooled connection" in its dashboard.
   It handles serverless/server connections more gracefully.

5. Click **Create Web Service**. First build takes ~5 minutes — watch the log.
   Success looks like: `> CodeRoom ready on http://localhost:10000 (prod)` and
   the service status turns **Live**.

**No seeding needed:** your Neon database already has all migrations + the
problem/test-case seeds applied from local development, and
`prisma migrate deploy` in the build keeps it in sync going forward.

---

## Step D — Verify the deployment (5-minute checklist)

Open your Render URL and:

1. ✅ Register a new account (e.g. `render-test@x.com`) → lands on dashboard
2. ✅ Create a room **with a problem attached** → workspace loads
3. ✅ Copy the join code → open the URL in a **second browser/incognito**, register, join
4. ✅ Type in one browser → appears live in the other (WebSockets working!)
5. ✅ Chat a message both ways
6. ✅ Press **Run** (sample tests) and **Submit** (graded) in the editor
7. ✅ Start/end an interview → appears in Interview History

If 4 fails but everything else works: WebSockets usually just need the service
restarted (Render dashboard → Manual Deploy → "Clear build cache & deploy").

---

## Everyday workflow from now on

Every time we finish a new phase:

```bash
git add . && git commit -m "..." && git push
```

Render auto-builds and auto-deploys the new version in ~3–5 minutes. That's it.

---

## Free-tier realities (know before you demo)

- The server **sleeps after ~15 min** without visitors; the next visit takes
  30–60 s to wake up (show the Render dashboard first if demoing).
- Optional: create a free **UptimeRobot** (https://uptimerobot.com) HTTP monitor
  pointed at your URL (every 10 min) to keep it awake *while you're actively
  sharing* — turn it off afterwards so you don't burn free tier hours.
- Judge0's public execution API is shared/free — occasional slow runs under
  load are normal, the app handles it with timeouts.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails on `prisma migrate deploy` | Check `DATABASE_URL` is the pooled Neon string, no quotes around it in Render |
| `CodeRoom ready` but page 502 | Check Start Command is exactly `npm start` (it must run `server.mjs`, not Next alone) |
| Login loops back to login | `AUTH_SECRET` missing/different between deploys — set it and redeploy |
| Run/Submit errors on execute | Public Judge0 hiccup; retry, and check the Render **Logs** tab |
| Real-time sync dead after idle wake | Render restarted the process — refresh both browsers |
