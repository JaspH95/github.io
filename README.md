# Knowfeed

A personal newspaper and learning app that ends. News comes in Morning, Midday and Evening editions that finish; when you're up to date, learning takes over (your job's skills, your interests, a language). It's a home-screen web app for iPhone. See `PRODUCT.md` for the why, `CLAUDE.md` for the build brief, and `SETUP.md` for getting it running.

## How it fits together

| Part | Where | What it does |
|---|---|---|
| App | `index.html`, `src/` | Vite + TypeScript PWA. Editions are built on the phone from the latest data |
| Pipeline | `pipeline/run.ts`, `.github/workflows/pipeline.yml` | Hourly on GitHub Actions: fetches every source, groups articles into stories, scores importance, writes AI summaries, picks images, writes `public/data/*.json` |
| Seed | `pipeline/seed.ts`, `.github/workflows/seed.yml` | Monthly: ESCO occupations and skills, and the GeoNames city list, for onboarding |
| Health check | `pipeline/check.ts`, `.github/workflows/check.yml` | Tests every key, source and serverless function |
| Serverless functions | `api/` | Live news (outlets, breaking, search), live football, interest search, skill of the day, local news for any city. Keys stay on the server |
| Interests | `content/interests.json` | The ~60 starter interests: news matching terms, Guardian sections, Wikipedia titles for learning |
| Extra learning topics | `content/topics.json` | Wikipedia titles for topics that aren't news interests (BSL) |
| Phrase packs | `content/phrases/*.json` | The one fixed content type. See `content/phrases/README.md` |
| Database | `supabase/schema.sql` | Accounts and sync (Supabase free tier). Paste into the Supabase SQL Editor |
| Legal pages | `public/about.html`, `privacy.html`, `terms.html`, `cookies.html`, `refunds.html`, `404.html` | Plain HTML with `public/legal.css`. Keep them in step with what the app stores and sends |

## The app, file by file

- `edition.ts`: which edition it is, catch-up, ranking (relevance, importance, freshness, personal ties, variety), the news and learning mix.
- `feed.ts` and `cards.ts`: the full-screen cards and the "You're up to date" screen.
- `story.ts`: the Particle-style story page, and learning articles.
- `chat.ts`: onboarding and the settings chat (no AI).
- `pages.ts`: Learn, Languages, Saved, Search and the menu. `lessons.ts`: 5-minute lessons and reviews. `srs.ts`: spaced repetition.
- `live.ts`, `audio.ts` (phrase pronunciation), `wellbeing.ts`, `recap.ts`, `dailyquiz.ts`, `share.ts`, `notify.ts`, `docs.ts`, `reset.ts`, `dev.ts`, `backup.ts`, `feedback.ts`, `events.ts`.
- `cloud.ts`: sign-in with an emailed code and sync to Supabase. `workareas.ts` and `jobmatch.ts`: matching someone's work to ESCO.
- Everything personal lives in the browser's storage (keys start with `kf2-`), and in the person's account if they sign in.

## Checking sources

After each pipeline run, `public/data/status.json` lists every source with `ok`, the item count and any error, plus summary and image stats. Failing sources are skipped and the rest still show. Note replacements in `sources.md`.

## Commands

```bash
npm run dev          # the app at http://localhost:5173
npm run build        # typecheck + production build
npm run pipeline     # fetch everything into public/data (see SETUP.md for options)
npm run seed         # jobs and cities
npm run check        # health check
```
