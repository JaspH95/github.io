# Knowfeed: getting set up (for Jasper)

Knowfeed already runs on free services you've connected: GitHub (code and the hourly news pipeline) and Vercel (hosting). This page covers what's left to switch on, how to get it on your iPhone, and how to test it.

## 1. Put the new version live

The new build is on the branch `claude/loving-ptolemy-8iimfd`. Vercel makes a preview of it automatically; merging it into `main` makes it your real site (https://github-io-ten-bice.vercel.app).

1. On GitHub, open the pull request for the branch (or create one) and merge it into `main`.
2. Vercel redeploys within a minute or two.

## 2. Keys (all free)

| Key | Where it goes | What it does | Status |
|---|---|---|---|
| `GEMINI_API_KEY` | GitHub secret | AI summaries of news stories | Set |
| `GUARDIAN_API_KEY` | GitHub secret **and** Vercel environment variable | News, plus interest search and local news for any city | Set in GitHub; **add it to Vercel** |
| `NASA_API_KEY` | GitHub secret | NASA picture of the day | Set |
| `API_FOOTBALL_KEY` | Vercel environment variable | Live scores for your teams | Add if you want live scores |
| `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY` | GitHub secrets | Backup photos for the few stories with none | Optional |

- **GitHub secrets:** repo → Settings → Secrets and variables → Actions → New repository secret.
- **Vercel variables:** Vercel → your project → Settings → Environment Variables. Redeploy after adding one.
- `.env.example` lists every key with where to get it.

## 3. Put it on your iPhone

1. Open the site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it from the Home Screen. It runs full screen and works offline with the last edition.

## 4. Testing it

- **Developer menu:** tap the Knowfeed wordmark 5 times. You can:
  - jump to the Morning, Midday or Evening edition
  - fake the time of day, to test catch-up
  - forget editions, reset onboarding, and clear likes, saves or learning progress
  - see which image source each card used, and the data and source status
- **Something wrong?** Every card's ••• menu and every story page has it. Notes are kept on the phone for now (Settings → Feedback and notes).
- **Health check:** GitHub → Actions → Health check → Run workflow. It tests every key, feed and serverless function and prints a pass or fail list.
- **Fresh news by hand:** Actions → Refresh feed data → Run workflow. It also runs hourly on `main`.
- **Jobs and cities list:** Actions → Refresh jobs and cities (monthly on its own).

## 5. Running it on your Mac (optional)

```bash
npm install
cp .env.example .env.local   # then paste your keys in
npm run check                # tests every key and source
npm run pipeline             # fetches today's news into public/data
npm run dev -- --host        # open the Network link on your iPhone, same Wi-Fi
```

- `npm run pipeline -- --only=news` runs one part (news, local, sport, learning or images).
- `npm run pipeline -- --record`, then `OFFLINE=1 npm run pipeline`: saves real responses to `fixtures/` once, then replays them without internet or using quotas.
- `npm run seed` rebuilds the jobs and cities lists.
- The `/api` functions (interest search, skills, local news, live football) run on Vercel. Locally, run `npx vercel dev` instead of `npm run dev` to use them.

## 6. Before inviting testers (phase 2)

Accounts, syncing between devices, push notifications, tester invites, the admin page and sending feedback all need a database. The plan is Supabase's free tier:

1. Create a project at https://supabase.com (free).
2. Copy the project URL, the anon key and the service role key (Project Settings → API).
3. Give them to Claude Code, which will add the tables, sign-in (email link and Google), sync and push notifications.

Until then, everything personal stays on the phone, which is fine for testing on your own.
