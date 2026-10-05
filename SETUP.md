# Knowfeed: getting set up (for Jasper)

Knowfeed already runs on free services you've connected: GitHub (code and the hourly news pipeline) and Vercel (hosting). This page covers what's left to switch on, how to get it on your iPhone, and how to test it.

## 1. Where it lives

Knowfeed is at **https://knowfeed-nine.vercel.app**. The address never changes.

- The site shows whatever is on the `main` branch. Vercel rebuilds it a minute or two after anything reaches `main`.
- Claude Code works on a branch, then merges every finished change into `main` straight away, so the address always has the latest version.
- On your iPhone, close Knowfeed and open it again to get a new version. There's no need to reinstall.

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

Without this, everything is kept only in the browser you used. On iPhone, Safari and the Home Screen app keep **separate** storage, so answers given in Safari don't appear in the Home Screen app. With accounts switched on, you sign in with an email and password and everything comes back, on any phone.

You've already made the Supabase project (Knowfeed, London). Four steps:

1. **Create the tables.** Supabase → your project → **SQL Editor** → **New query**. Open `supabase/schema.sql` in this repo, copy all of it in, press **Run**. You should see "Success. No rows returned".
2. **Switch off confirmation emails.** Supabase → **Authentication** → **Sign In / Providers** → **Email** → turn **Confirm email** off → **Save**. Knowfeed then never needs to send an email, which matters because Supabase's free email sender is very limited and its emails can't be changed on the free plan.
3. **Set the site address.** Supabase → **Authentication** → **URL Configuration** → **Site URL**: `https://knowfeed-nine.vercel.app`.
4. **Give Vercel the two public values.** Supabase → **Project Settings** → **API Keys** (and **Data API** for the URL). In Vercel → your project → **Settings** → **Environment Variables**, add:
   - `SUPABASE_URL` = `https://nujdjtrmulzgnwcijpqw.supabase.co`
   - `SUPABASE_ANON_KEY` = the **publishable** key (starts `sb_publishable_`), or the legacy **anon** key
   Then **Deployments** → the latest one → **⋯** → **Redeploy**.

The **secret** / **service_role** key is never needed by the app. Only put it in GitHub secrets (`SUPABASE_SERVICE_ROLE_KEY`) when the admin page is built, and never paste it into a chat.

Then on your iPhone: open Knowfeed → **Profile** → tap your name → **Sign in or create an account**. Your iPhone offers to save the password in Passwords. On a new phone, or the Home Screen app, choose **Sign in and bring back my answers** at the start.

**Forgotten passwords:** testers can choose **Forgot my password** when signing in, or **Profile → their name → Forgot password**. Supabase emails a link; it opens Knowfeed on "Choose a new password". Two things make it work:
1. Supabase → **Authentication** → **URL Configuration** → **Redirect URLs** → **Add URL**: `https://knowfeed-nine.vercel.app/**` (and keep the Site URL above).
2. **Your own email sender (needed).** Supabase's built-in sender only delivers to people in your Supabase team, about 2 an hour, so testers would never get the email. Connect your iCloud mail instead (below, "Your own email sender"). Until then, reset someone by hand: Supabase → **Authentication** → **Users** → **⋯** → **Send password recovery**, or delete the user so they can sign up again.

**Your own email sender (iCloud, free):** at appleid.apple.com → **Sign-In and Security** → **App-Specific Passwords**, make one called Knowfeed. Then Supabase → **Authentication** → **Emails** → **SMTP Settings** → turn on **Enable custom SMTP**: sender email `jasperhayward@me.com`, sender name `Knowfeed`, host `smtp.mail.me.com`, port `587`, username `jasperhayward@me.com`, password the app-specific password → **Save**. Then in **Emails** → **Reset Password**, you can change the subject to "Reset your Knowfeed password".

**Good to know**
- **Emailed sign-in codes later (optional):** once your own email sender is connected (above), you can edit the emails again. Add `<p>Your Knowfeed code: <strong>{{ .Token }}</strong></p>` to the Magic Link email, then add `SUPABASE_EMAIL_CODES` = `1` in Vercel and redeploy. Knowfeed then signs in with a code instead of a password, and password resets work by email.
- Free Supabase projects pause after 7 days with no use. Daily use keeps it awake; if it pauses, press Restore in Supabase.
- Each tester's data is private to them (row-level security on every table).

## 7. Feedback emails (Resend, free)

Every note from the feedback button ("Something wrong?" on a card, or Feedback in settings) is emailed to you. If the tester is signed in, their email is the reply-to address, so you can just press Reply.

1. Make a free account at **resend.com**, signing up with **jasperhayward@me.com** (until you verify a domain of your own, Resend only delivers to the address the account was made with, which is exactly what's needed here).
2. Resend → **API Keys** → **Create API Key** (name: Knowfeed, permission: Sending access) → copy it.
3. Vercel → your project → **Settings** → **Environment Variables** → add `RESEND_API_KEY` with that key → **Save**, then **Redeploy**.

Until the key is added, notes are still kept on the phone (and in Supabase for signed-in testers); nothing is lost.

## 8. Notifications ("your edition is ready")

Testers turn them on in **Profile → Notifications**. They need an account, and on iPhone, Knowfeed added to the Home Screen (iOS 16.4 or later). A GitHub job checks every 15 minutes and sends one when an edition's time comes: only if there's new news, never in quiet hours, at most 3 a day.

1. **Database:** run `supabase/schema.sql` again in the SQL Editor (it's safe to re-run; it adds the `push_subscriptions` table).
2. **Keys:** you need a VAPID key pair (I'll give you one, or make your own with `npx web-push generate-vapid-keys`).
   - Vercel → Environment Variables: `VAPID_PUBLIC_KEY` (public key only) → Redeploy.
   - GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → New repository secret, add all four: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys → the **secret** / service_role key; it only ever goes in GitHub secrets, never in the app or a chat).
3. **Check:** GitHub → **Actions** → **Edition notifications** → **Run workflow** with "Only print what would be sent" ticked. The log shows who would get one.

## 9. Still to come before testers

Tester invites, the admin page and Google sign-in.
