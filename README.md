# Knowfeed

A swipe-to-learn feed of live news, knowledge and languages, built as a home-screen web app for iPhone. See `CLAUDE.md` for the full brief and `sources.md` for every feed.

## How it fits together

| Part | Where | What it does |
|---|---|---|
| App | `index.html`, `src/` | Vite + TypeScript PWA, ported from `reference/knowfeed-prototype.html` |
| Pipeline | `pipeline/`, `.github/workflows/pipeline.yml` | Runs hourly on GitHub Actions, fetches every source, writes `public/data/*.json`, commits only if something changed |
| Live football | `api/live.ts` | Vercel function holding the API-Football key, cached 2 minutes |
| Topic lists | `content/topics.json` | Wikipedia titles per learning topic. Edit freely |
| Phrase packs | `content/phrases/<language>.json` | The one fixed content type (see `CLAUDE.md`) |

## Setup (one time)

1. **Free API keys**
   - Gemini (AI summaries): https://aistudio.google.com/apikey
   - The Guardian: https://open-platform.theguardian.com/access/ (developer key)
   - NASA: https://api.nasa.gov (works without one, but a key avoids rate limits)
   - API-Football: https://dashboard.api-football.com/register (free plan)
2. **GitHub secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
   `GEMINI_API_KEY`, `GUARDIAN_API_KEY`, `NASA_API_KEY`.
3. **Vercel** (https://vercel.com/new, Hobby plan): import this GitHub repo. The settings come from `vercel.json`, so leave the defaults. Then add the environment variable `API_FOOTBALL_KEY`. Every push redeploys, including the hourly data commits.
4. **iPhone**: open the Vercel URL in Safari → Share → Add to Home Screen.

The hourly schedule only runs on the repo's default branch. To refresh by hand: Actions → Refresh feed data → Run workflow.

## Checking sources

After each pipeline run, `public/data/status.json` lists every source with `ok`, the item count and any error. Sources that fail are skipped quietly and the rest still show. Update `sources.md` if you replace one.

## Local development

```bash
npm install
npm run pipeline   # fetch live data into public/data (keys read from env vars)
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```
