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

## 6. Accounts: so Knowfeed remembers you (Supabase, free)

Without this, everything is kept only in the browser you used. On iPhone, Safari and the Home Screen app keep **separate** storage, so answers given in Safari don't appear in the Home Screen app. With accounts switched on, you sign in with a code sent to your email and everything comes back, on any phone.

You've already made the Supabase project (Knowfeed, London). Four steps:

1. **Create the tables.** Supabase → your project → **SQL Editor** → **New query**. Open `supabase/schema.sql` in this repo, copy all of it in, press **Run**. You should see "Success. No rows returned".
2. **Put the code in the sign-in email.** Supabase → **Authentication** → **Emails** (or Email Templates) → **Magic Link**. In the message body, add this line and save:
   ```
   <p>Your Knowfeed code: <strong>{{ .Token }}</strong></p>
   ```
   (The app asks for the code rather than using the link, because a link would open Safari instead of the Home Screen app.)
3. **Set the site address.** Supabase → **Authentication** → **URL Configuration** → **Site URL**: your Vercel address (for example `https://knowfeed.vercel.app`).
4. **Give Vercel the two public values.** Supabase → **Project Settings** → **API Keys** (and **Data API** for the URL). In Vercel → your project → **Settings** → **Environment Variables**, add:
   - `SUPABASE_URL` = `https://nujdjtrmulzgnwcijpqw.supabase.co`
   - `SUPABASE_ANON_KEY` = the **publishable** key (starts `sb_publishable_`), or the legacy **anon** key
   Then **Deployments** → the latest one → **⋯** → **Redeploy**.

The **secret** / **service_role** key is never needed by the app. Only put it in GitHub secrets (`SUPABASE_SERVICE_ROLE_KEY`) when the admin page is built, and never paste it into a chat.

Then on your iPhone: open Knowfeed → Settings (top right) → **Sign in to save my answers**. On a new phone, or the Home Screen app, choose **Sign in and bring back my answers** at the start.

**Good to know**
- Supabase's built-in email only sends to members of your Supabase team, and only a few emails an hour. That's fine for you. Before inviting testers, connect a free email sender (Resend's free plan, 3,000 emails a month): Supabase → Authentication → Emails → SMTP Settings.
- Free Supabase projects pause after 7 days with no use. Daily use keeps it awake; if it pauses, press Restore in Supabase.
- Each tester's data is private to them (row-level security on every table).

## 7. A more natural voice for Listen

Listen uses the phone's own voices. The standard iPhone voices sound robotic, but iPhone has natural "Enhanced" and "Premium" voices that are free: **Settings → Accessibility → Spoken Content → Voices → English → pick one marked Enhanced or Premium** (for example Jamie, Serena or Daniel) and download it. Then in Knowfeed: Settings → **Listening voice**, and choose it. Knowfeed picks the best installed voice automatically.

## 8. Still to come before testers

Tester invites, the admin page, push notifications, and Google sign-in.
