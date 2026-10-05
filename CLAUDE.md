# Knowfeed: free beta build brief

Read `PRODUCT.md` first. It explains the why. This file explains what to build and how.

## Goal

A free, fully working beta for 20 to 50 testers that feels personal, looks professional, and runs entirely on free tiers:
- **News in editions that end:** Morning, Midday and Evening, with catch-up if you've been away.
- **Particle-style story pages:** tap a card to open the full story.
- **Learning for any job, any interest and about 25 languages,** including Imprint-style Series.
- **Real, sourced content only.** No placeholders.

## Reference files

- `knowfeed-prototype.html`: the design language, gestures and onboarding chat style. Its content is placeholder; don't reuse it.
- `week-reader-reference.html`: the closest thing to the finished reading experience.
  - Week and day structure, the finite feed, the done screen, Saved, Listen, and the article page with sources.
  - Its content is a real one-off week and must not be reused as live content.
- `onboarding-style-reference.png`: the onboarding look.
  - Black screen with a glowing header.
  - Each question types out in the middle of the screen, then drifts upwards and fades.
  - Answers are pill buttons, and chosen answers show in mint.
- `sources.md`: every free data source.
- `story-page-reference.html`: the story page, matched to Particle from Jasper's screen recording. Match it closely. It includes:
  - the dark theme
  - glass floating controls: a back button, a play and share pill, and a more button
  - entity names highlighted in light blue in the headline, subheading and summary
  - Overview, The 5 Ws and Timeline tabs
  - a serif summary panel
  - a sideways-scrolling "N Articles" section with outlet, age and headline
  - Quotes
  - People, Places & Things with Follow buttons
  - Learn the background
  - Related Stories cards
  - a floating Follow story and Save dock
- **Particle features deliberately left out:** ads, comments, Ask Question, Explain Like I'm 5, Opposite Sides and podcast clips.

## Design standards (professional look)

- **Wordmark:** "Knowfeed" in Bricolage Grotesque 800 with a yellow dot (#FFD23F). Body text in Instrument Sans.
- **Every card has a strong image** (see Images). No blank or low-resolution cards.
- **Typography:** consistent scale, generous spacing, and no more than 2 short sentences on a feed card.
- **Light and dark themes,** safe areas respected, 60fps swiping, and a skeleton loading state (never a blank screen).
- **Accessibility:** WCAG AA contrast, text size that follows device settings, and full screen-reader labels.
- **Quality bar:** it should look like a premium publication. If something looks cheap, fix it before moving on.

## Free stack

- **App:** a PWA built with Vite and TypeScript, installable to the home screen, with a service worker for offline reading and web push.
- **Hosting:** Vercel Hobby, with serverless functions in `/api`. The free plan is for non-commercial use; a free beta is fine, but switch plans before charging.
- **Database and accounts:** Supabase free tier.
  - Postgres, auth (email magic link and Google sign-in), and row-level security on every table.
  - Free projects pause after 7 days of inactivity; daily beta use keeps it awake.
- **Pipeline:** GitHub Actions cron, hourly, in a private repo (2,000 free minutes a month). It fetches, clusters, summarises, finds images and writes to Supabase.
- **AI:** Gemini API free tier, pipeline only, for story summaries. It's never called from the phone.
- **Live football:** API-Football free plan through `/api/live`, with a 2-minute shared cache.
- **Analytics:** an `events` table in Supabase. No third-party trackers.

### Secrets

Keep these in GitHub and Vercel secrets only:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GUARDIAN_API_KEY`
- `API_FOOTBALL_KEY`
- `NASA_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `PEXELS_API_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

## Data model (Supabase)

- **`profiles`:**
  - `id`, `name`, `city`, `timezone`
  - `occupation_uri` (ESCO), `job_title_raw`
  - `edition_times` (json), `quiet_hours` (json), `daily_goal_min`, `daily_limit_min` (nullable)
  - `created_at`
- **Interests:**
  - `interests`: `id`, `label`, `source` (starter, guardian_tag, wikipedia), `guardian_tag`, `wikidata_id`, `category`
  - `user_interests`: `user_id`, `interest_id`, `mode` (news, learn, both), `weight`
- **Skills:**
  - `occupations`: an ESCO subset with `uri`, `title`, `alt_labels[]`, `isco_group`, `description`
  - `occupation_skills`: `occupation_uri`, `skill_uri`, `type` (essential, optional)
  - `skills`: `uri`, `label`, `description`, `wikipedia_title` (nullable)
  - `user_skills`: `user_id`, `skill_uri`, `source` (job, chosen)
- **Languages:**
  - `user_languages`: `user_id`, `language`, `level`, `goal`
- **Stories:**
  - `stories`: `id`, `title`, `topic_tags[]`, `importance`, `first_seen`, `last_updated`, `summary` (json), `image` (json), `entities` (json)
  - `story_articles`: `story_id`, `outlet`, `url`, `title`, `standfirst`, `published_at`, `image_url`
  - `story_timeline`: `story_id`, `at`, `text`, `source_url`
- **Learning content:**
  - `cards`: learning cards with `id`, `type`, `topic`, `skill_uri`, `content` (json), `sources` (json), `image` (json), `confidence`, `reviewed`
  - `series`: `id`, `title`, `kind` (skill, language, idea, book), `topic`, `episodes`, `reviewed`
  - `episodes`: `series_id`, `n`, `cards` (json)
  - `phrases`: `id`, `language`, `phrase`, `romanisation`, `say`, `meaning`, `when`, `theme`, `level`, `formality`, `notes`, `checked`
- **Progress:**
  - `progress`: `user_id`, `item_id`, `kind`, `step`, `due_at`, `learned` (spaced repetition for phrases, quizzes and skills)
- **Interactions and follows:**
  - `interactions`: `user_id`, `item_id`, `kind` (seen, open, like, save, finish, skip, quiz_right, quiz_wrong), `at`
  - `follows`: `user_id`, `story_id` or `team` or `competition`
- **Editions:**
  - `editions`: `user_id`, `slot` (morning, midday, evening), `date`, `items` (json), `built_at`, `finished_at`
- **Other:**
  - `push_subscriptions`: `user_id`, `endpoint`, `keys`
  - `feedback`: `user_id`, `item_id` (nullable), `text`, `at`
  - `events`: `user_id`, `name`, `props`, `at`

## Onboarding (chat style, no forced lists)

Keep the look from the prototype: typed-out questions mid-screen, fading history, pill answers, and the text box directly under the question so the keyboard never hides it.

1. **Name.**
2. **City:** type any city. Autocomplete from a free city list. We pick the nearest local news sources.
3. **Job:** "What do you do for work?"
   - People type their job title in their own words.
   - Fuzzy-search ESCO occupations, titles and alternative labels (Fuse.js, on the phone), then show the top 3 matches as pills plus "Something else".
   - If nothing matches, store the raw title and let the person pick a job family from about 20 broad groups (from ESCO's ISCO groups).
   - Then show that occupation's top skills as pills: "Which of these do you want to get better at?"
4. **Interests:**
   - Show about 60 starter interests grouped by category.
   - Also offer "Type anything else" with live search against the Guardian tags API and Wikipedia search, via a `/api/interest-search` function.
   - For each pick, ask "News, learning, or both?" (default both).
5. **Languages:**
   - "Want to learn a language?" with pills for about 25 languages plus a search box.
   - Then ask the level (new, some basics, getting by, confident) and the goal (travel, family, work, fun).
6. **Sport:** "Any sports or teams to keep an eye on?" with sport pills plus a team search. Keep it light.
7. **Editions:** "When do you like to catch up?" Defaults: 07:00, 12:30, 18:00. Quiet hours default to 09:00 to 12:00 and 13:30 to 17:30 on weekdays.
8. **Topics to avoid.**
9. **Summary:** "Here's your Knowfeed", showing a preview of the first edition, then "Show my feed".

Everything can be changed later in the settings chat. That chat runs on the phone with no AI and offers suggestions based on likes.

### Starter interests (about 60)

- **News:** World, UK politics, US politics, Europe, Business, Economy, Climate, Health, Education, Crime and justice, Housing
- **Tech:** AI, Gadgets, Cybersecurity, Startups, Software, Social media, Gaming, Crypto
- **Science:** Space, Physics, Biology, Medicine, Environment, Psychology, Neuroscience, Archaeology
- **Money:** Personal finance, Investing, Property, Careers, Entrepreneurship, Marketing, Sales
- **Culture:** Film, TV, Music, Books, Art, Design, Architecture, Fashion, Food and drink, Travel, History, Philosophy
- **Life:** Fitness, Running, Cycling, Triathlon, Nutrition, Mental wellbeing, Parenting, Pets, Gardening, Cars
- **Sport:** Football, Rugby, Cricket, Tennis, Formula 1, Golf, Boxing and MMA, Athletics, NFL, Basketball

### Languages at launch

Spanish, French, German, Italian, Portuguese, Dutch, Swedish, Norwegian, Danish, Polish, Romanian, Greek, Turkish, Russian, Ukrainian, Arabic, Hebrew, Hindi, Urdu, Mandarin Chinese, Japanese, Korean, Vietnamese, Thai, Indonesian, Irish and Welsh, plus British Sign Language (vowels animation and facts only until Deaf-reviewed signs exist).

## Editions (the core loop)

### Pipeline (hourly, GitHub Actions)

1. **Fetch** all sources.
2. **Cluster** articles into stories (title similarity plus shared entities).
3. **Update** `stories`, `story_articles` and `story_timeline`.
4. **Score importance:**
   - how many distinct outlets are covering the story
   - how fast coverage is growing
   - whether a major outlet puts it top of its homepage feed
5. **Summarise** new or changed stories with Gemini (see Story page). Cap at about 25 per run and cache by story.
6. **Pick the image** for each story (see Images).
7. **Refresh learning content** (Wikipedia, NASA, ESCO skill cards).

### Building an edition

This runs on request in `/api/edition`, cached per user per slot.
- **Candidates:** all stories since the user's last finished edition, or since the start of the day.
- **Ranking:** the score from `PRODUCT.md`:
  - 35% relevance
  - 25% importance
  - 15% freshness
  - 15% personal ties
  - 10% variety
- **Everyone sees the top 2 or 3 stories of the day,** even outside their interests.
- **Catch-up:** if earlier slots today weren't opened, merge them with a "While you were away" header, and cap at about 20 stories. The rest go to "Earlier today" at the end.
- **Mix:**
  - 50 to 60% news
  - 30 to 40% learning: skill of the day, a Series episode, a phrase, a data quiz
  - about 10% light: sport page, culture, a fun fact
- **No same topic twice in a row.**
- **Sports page:** one card with the user's teams' results and fixtures plus 1 or 2 sport headlines.
- **Live matches:** only a slim banner at the top while the user's team is playing.
- **Just in:** stories with high importance that match the user's interests can appear between editions as a banner at the top of the app.

### Finishing an edition

- The done screen reads "You're up to date", with the next edition time and a short summary: stories read, things learned, quiz score.
- **Then learning takes over:**
  - continue today's Series episode
  - a 5-minute language lesson
  - a review of 5 due items (spaced repetition)
  - explore the library
- **Never offer more news here.**

## Story page (Particle-style)

Build it to match `story-page-reference.html`.

- **Hero image** with credit. Topic, time, and "Updated 2h ago" when the story is still developing.
- **Headline.**
- **The gist:** 3 short bullet takeaways.
- **Summary sections:** "What happened", "Why it matters", "What happens next" (skip any the sources don't support).
- **Coverage:**
  - the outlets covering the story, with count and time
  - each opens the original
- **Timeline:** for developing or followed stories, what changed and when.
- **People and places:** chips that open a Wikipedia summary sheet.
- **Background:** a linked learning card or Series if one exists ("New to this? Learn the basics in 2 minutes").
- **Tools:** Follow story, Save, Like, Listen, Share.
- **Getting back:** a fixed back button, pull down to close, or swipe right.

### Gemini summary prompt (pipeline only)

Input is the text of up to 5 articles in the cluster: full text from the Guardian API, or extracted with Readability for other outlets. Use it only as input; never store or show the full text.

> Using only the articles below, write: (1) three bullet takeaways of max 15 words each, and (2) up to three short sections titled "What happened", "Why it matters", "What happens next". Skip any section the articles don't support. British English, plain and neutral. Don't add facts, names or numbers that aren't in the articles. Don't quote more than 10 words in a row. Where outlets disagree, say so briefly. Return JSON.

Validate the output:
- It must be valid JSON.
- Every number and proper noun must appear in the source text.
- It must stay within the word limits.
- If validation fails, show the lead outlet's standfirst only.

## Images (always professional)

For every story and learning card, try these in order:
1. **The article's own image:** `og:image`, `media:content` or the Guardian `thumbnail`. Pick the best-quality one in the cluster.
2. **Wikimedia Commons:** the lead image of the story's main entity, or the Wikipedia page image for learning cards. It's free-licence; show the credit.
3. **Stock photos:** Unsplash, then Pexels, searched by topic and entity keywords. Follow their attribution rules (Unsplash requires using their image URLs and reporting downloads).
4. **Designed covers:** a system of Knowfeed topic covers, one family per topic, with a gradient, a large topic mark, subtle texture and consistent typography. Build them as SVG. They must look deliberate, never like a missing image.

Image quality rules:
- **Minimum 1080px wide.**
- **Cropping:** choose the focal point with smartcrop so faces and subjects aren't cut. Make 9:16 crops for feed cards and 16:9 for story pages.
- **Loading:** show a blurred placeholder (BlurHash) while the image loads.
- **Reject:** images that are mostly text, logos, or already used on a nearby card.
- **Credit:** always store and show the credit (outlet, photographer, licence).
- **Beta vs launch:** in the beta, publisher images are shown with credit and a link. Before a public launch, review image rights with each source or switch to licensed images.

## Learning engine

- **Skill of the day:**
  - pick from the user's chosen skills
  - card built from the ESCO skill description plus the related Wikipedia summary
  - plus a related news story if there is one
- **Series:**
  - 5 to 8 cards per episode.
  - Kinds:
    - **Skill:** starting with the 20 most common job families.
    - **Language scenarios.**
    - **Ideas and history:** from Wikipedia and other reliable sources.
    - **Classic books:** out of copyright, from Project Gutenberg.
  - Claude Code drafts them in batches from cited sources.
  - Each Series has `reviewed=false` until Jasper or a reviewer approves it. Only reviewed Series appear in the beta, except language Series, which show "Not yet checked".
- **Books:** per topic, recommendations from Open Library (cover, description, link). Don't summarise modern books.
- **Languages:**
  - 100+ phrases per language, created by Claude Code, with a `checked` flag.
  - Phrase of the day, Hear it (normal and slow), scenario Series, and "Remember this?" reviews at 1, 3, 7, 14 and 30 days.
  - At most 3 reviews a day per language.
  - Progress line, for example "Romanian: 42 learned".
- **Quizzes:** only generated from data (Wikipedia On this day, Wikidata facts, the user's own saved and learned items). Never invented.

## Notifications (web push)

- **Setup:** VAPID keys, with subscriptions stored in Supabase.
- **Sending:** a GitHub Actions job every 15 minutes sends a push when a user's edition time arrives, respecting their time zone and quiet hours.
- **When to send:**
  - only if the edition has new stories
  - maximum 3 a day
  - never during quiet hours
- **Copy example:** "Your midday edition: 9 stories · about 6 minutes."
- **iPhone:** web push only works when Knowfeed is added to the home screen (iOS 16.4 or later). Onboarding should guide testers through adding it.

## Wellbeing

- No autoplay and no infinite feed.
- Optional daily reading goal and optional daily limit (off by default).
- After 45 minutes of continuous use, a gentle check-in card.
- A weekly recap: time spent, stories read, things learned, language progress.

## Beta extras

- **Feedback:** a button on every card ("Something wrong?") and in settings.
- **Tester invite links:** a simple allow-list in Supabase.
- **Data:** export and delete account in settings (UK GDPR).
- **Events to log:**
  - `edition_open`
  - `edition_finish`
  - `card_seen`
  - `story_open`
  - `like`
  - `save`
  - `series_finish`
  - `lesson_finish`
  - `notification_open`
  - `feedback`
- **A simple admin page for Jasper:**
  - how many testers came back after 1, 7 and 30 days
  - editions finished
  - top skipped topics
  - feedback

## Local test version (build this first)

Jasper wants a version he can run and change on his MacBook, using the real connections, before anything goes online.

- **Run it locally:**
  - `npm run dev` starts the app.
  - `npm run dev -- --host` makes it available on Jasper's iPhone over the same Wi-Fi, at the network URL Vite prints.
- **Use the real services from day one:**
  - A hosted Supabase free project, so there's no Docker needed.
  - Real API keys in `.env.local` (never committed).
  - Provide `.env.example` listing every key, with a comment saying where to get it.
- **Run the pipeline by hand:**
  - `npm run pipeline` does one full fetch, cluster, summarise and image run, exactly what GitHub Actions will do hourly later.
  - `npm run pipeline -- --only=news|learning|sport|images` runs one part at a time for testing.
- **Offline mode (record and replay):**
  - `npm run pipeline -- --record` saves every API response to `fixtures/`.
  - `OFFLINE=1 npm run dev` (or `OFFLINE=1 npm run pipeline`) replays those saved responses instead of calling the internet.
  - This lets Jasper test and change things without using API quotas, and work with no connection at all.
  - Use real recorded data only, never invented data.
- **Health check:** `npm run check` tests every source and key and prints a clear pass or fail list, for example "Guardian API: OK", "API-Football: key missing".
- **Seed data:** `npm run seed` loads ESCO occupations and skills, the starter interests, languages and phrase packs into Supabase.
- **Dev menu:** a hidden developer menu in the app, opened by tapping the wordmark 5 times, with options to:
  - switch between the Morning, Midday and Evening editions
  - fake the time of day, to test catch-up
  - reset onboarding
  - clear likes and saves
  - trigger a test notification
  - show which image source each card used
- **Deploying later:** only after Jasper is happy locally, connect GitHub Actions and Vercel as in the build order.

## Build order

1. **Foundation (local first, see above):**
   - Port the prototype look to Vite and TypeScript as a PWA.
   - Add `.env.example`, `npm run check`, the pipeline command, record and replay, and the dev menu.
   - Set up Supabase auth and the tables above.
   - Deploy to Vercel and install it on Jasper's iPhone.
2. **News pipeline:** the sources, clustering, importance scoring and images. Show real stories in a simple feed.
3. **Story page:** summaries, coverage, timeline, people and places, Follow story.
4. **Editions:** ranking, catch-up, the sports page, the done screen, and "Just in".
5. **Onboarding:**
   - ESCO job matching
   - interest search
   - languages with level and goal
   - editions and quiet hours
6. **Learning engine:** skill of the day, spaced repetition, and phrase packs for the first 5 languages. Then the rest.
7. **Series:** the first 20 skill Series, 5 language scenario Series, and 3 classic books, all reviewed.
8. **Notifications, wellbeing features and Listen mode.**
9. **Beta extras:**
   - feedback
   - invites
   - admin page
   - export and delete account
   - a design polish pass across every screen
10. **Beta launch:** invite 20 to 50 testers. Review after 2 weeks and after 4 weeks.

## Rules

- No placeholder or invented content in the app. If a source has nothing, hide that card type.
- Every fact is sourced, and every news item links to the original. Summaries are only written from source text.
- Never store or show full article text.
- British English, plain, friendly and neutral on politics.
- Test on a 390×844 iPhone screen at every step, including the keyboard during onboarding.
- Before calling any step done, search the UI for "sample", "placeholder", "lorem", "Rivals FC" and "Driver A".

## Build status and decisions (keep this up to date)

Done (build order 1 to 7, local-first parts, on free services already connected):
- **Hosting:** Vercel project "Knowfeed" at https://knowfeed-nine.vercel.app (production = `main`), and the hourly GitHub Actions pipeline.
- **Standing instruction from Jasper:** merge every finished, tested change into `main` straight away (pull request, then merge) so the one address always has the latest version. Don't leave work sitting on a branch. The repo is public, so Actions minutes are unlimited.
- **Pipeline:** stories persist between runs (`pipeline/cache/stories.json`) with first seen, coverage growth, timeline and importance. Grouping uses rare shared words and numbers.
- **Gemini:** tries free-tier Flash models in turn and handles daily and per-minute quotas. Transient failures are never cached. It gets one retry with feedback if the checks fail.
- **Images:** article → og:image → Wikipedia entity → Unsplash/Pexels (if keys) → designed cover. Every image gets size and logo checks, a blurred preview and a focal point.
- **App:**
  - editions, catch-up, Earlier today and Just in
  - story page
  - onboarding with ESCO and GeoNames
  - Learn, Languages, Saved and Search tabs
  - lessons and spaced repetition
  - sports page and live football banner
  - wellbeing, dev menu, feedback notes, export and delete
- **Phrase packs:** Spanish, French, German, Italian and Portuguese (European), about 135 each, all `checked: false`.

Decisions that differ slightly from the brief:
- **Editions are built on the phone** from the hourly static data, not in `/api/edition`. The result is the same, it's free, and it works offline. The ranking weights are the same.
- **Blurred placeholders** are a tiny WebP preview made in the pipeline, instead of BlurHash. It looks the same and needs no decoder on the phone.
- **Local news:** BBC regions cover UK towns (nearest region by distance); 20 world cities are covered by the pipeline; anywhere else uses `/api/local` (Guardian search).
- **London Tube status stays out** (removed on purpose earlier).
- **Series (started):** Imprint-style courses in `content/series/*.json` (format and review steps in `content/series/README.md`), played one card at a time by `src/series.ts` (tap right to go on, left to go back; quick checks; recap; language Series use phrases from the packs with Hear it). One episode a day per Series appears in editions, the done screen offers "continue", and Learn lists them all. Progress syncs with the account. First batch (drafts, `reviewed: false`): How your mind tricks you, How the internet was built, The universe in four big ideas, Marketing essentials, How money works, The Art of War (Giles translation, quotes verified), and Spanish: a day in Madrid (language, shown as "Not yet checked"). Drafts only show with the developer menu's "Show Series drafts for review". `npm run check` verifies every source link and book quote.

- **Accounts (phase 2 started):** Supabase with `supabase/schema.sql` (profiles, user_state, events, feedback, invites; RLS on all). Sign-in is **email and password** with "Confirm email" off, because free Supabase projects can't edit email templates without custom SMTP, and magic links open Safari rather than the Home Screen app. An emailed-code sign-in is built in and switches on with `SUPABASE_EMAIL_CODES=1` once custom SMTP and `{{ .Token }}` are set up. Sync (`src/cloud.ts`) stores each part of local state with a timestamp in one `user_state` document and merges newest-wins. Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` reach the app (via `vite.config.ts`).
- **Navigation:** a floating liquid-glass pill tab bar: Edition, Chat (the settings chat), Search (in the middle), Saved, Profile. The top bar is the see-through gradient, set 30px below the status bar (`--top`) to clear iPhone's top-edge fade; tapping the wordmark goes back to the top. iOS 26 Home Screen apps get a page 47px shorter than the screen (WebKit bug 301108), which left a black strip at the bottom: `main.ts` measures the shortfall, stretches the page into it (`html.ios-shim`, `--shim`), turns off clipping and holds the page still. Everything is positioned against the body.
- **Learning first:** every edition is mostly learning. News is only what people ask for: breaking headlines (on unless turned off), outlets they follow (`profile.outlets`, from `OUTLETS` in `api/news.ts`), topics they follow (starter interests matched to the hourly stories, plus a live feed for any topic they typed in), their area and their sport. News is capped (normal edition: 2 breaking, 3 outlets, 3 topics, 1 local, 1 sport) and never outweighs learning. Learning pools grow from each interest's hand-picked Wikipedia titles plus Wikipedia's own "more like this" (`pipeline/cache/learnpool.json`), 5 new cards per interest a day; topics typed in for learning get related Wikipedia articles fetched on the phone once a day.
- **Live news (`/api/news`):** outlet feeds, breaking headlines by region (uk, us, ie, au, world) and search, read live from outlets' own RSS and cached at Vercel's edge. Live items become stories with `via` (why they're here) and open in the story page with a link to the original. The Search tab shows learning, stories in your Knowfeed, "Latest news" from every outlet, and Wikipedia.
- **In the feed, not in tabs:** learning, languages and sport. Phrase cards have "Start 5-minute lesson", learning cards "Start learning", and sport stories appear like any other story (up to 3, or 5 in a catch-up). There's no sports page card or Sport page. The Learn and Languages pages open from the done screen.
- **After the done card:** unread stories from earlier today follow, each tagged "Earlier today". The progress bar ends at the done card.
- **Onboarding interests:** two questions, what to follow in the news and what to learn about, each with search for anything. A topic in both is mode "both".
- **Profile:** Talk to Knowfeed, suggestions to follow worked out from likes (`src/suggest.ts`), what you follow, account, and every settings section.
- **Likes:** double tap anywhere on a card to like; a single tap on the headline or text opens it. After a like, a small glass pill above the tab bar offers "+ Follow <topic>" and fades after a few seconds (asked once each).
- **Onboarding work step:** areas of work first (`src/workareas.ts`), then job title or a description, six matches with "None of these" to try again, and area-based skills if no job fits. Sport is asked once; picked sports become news interests.
- **No repeats:** every story you've seen, opened, marked as read or said no to goes into a history (`kf2-history`, synced, kept 7 days for seen and 21 for the rest) with its headline. Later editions, Earlier today and Just in leave out anything in it, including the same news from another outlet (`sameEvent` in `src/similar.ts`: similar words, or the same two names plus a third word). Editions are deduplicated the same way. Reopening an edition you've started picks up at the first unseen card.
- **Mark as read and Not interested:** two small buttons on every news card (also in the card and story menus). Mark as read hides the story for good. Not interested offers: I already know about this, not interested in this story, stop following that topic's news (learning stays) or show fewer of it, stop following the outlet, or turn off breaking headlines. The card folds away straight after. Hidden stories can be brought back in Profile → Breaking news and outlets.
- **New things, not general knowledge:** learning cards skip Wikipedia articles most people already know, measured by average daily page views (pipeline drops anything over 3,000 a day; the app hides anything over 1,000 by default). "I know this" on a learning card hides it and halves that limit for the interest (`kf2-depth`, synced), or can skip straight to deeper cards or stop learning that topic. Topic cards show the intro's most surprising sentence (a first, a record, an origin, quoted word for word) instead of the definition.
- **Did you know…:** facts from Wikipedia's main page (each checked against a cited source by Wikipedia's editors), collected from the Did you know template, Recent additions and last month's archive into `pipeline/cache/facts.json`. The newest go out first, then a slow rotation. Two or three per edition (favouring your learning topics), and they fill in when a topic runs short. They also appear on the Learn page.
- **Feed images:** wide photos show whole at the top over a blurred copy of themselves, instead of being zoomed to fill a tall card.
- **Legal and privacy (October 2026):** static pages in `public/` (plain HTML, shared `legal.css`): `/about` (business details: run by Jasper Hayward as an individual in the UK, free non-commercial beta, contact jasperhayward@me.com), `/privacy`, `/terms`, `/cookies`, `/refunds` (free, nothing to refund) and a custom `404.html`. Clean URLs via `vercel.json`. Keep them true to the code: update them whenever what's stored, sent or shown changes. Linked from Profile → About and legal, the consent banner and the account sign-up step.
- **Consent:** no cookies. A first-open banner (`src/consent.ts`) asks about usage stats with two equal buttons; `events.ts` logs nothing and `cloud.ts` uploads nothing unless allowed. Turning stats off (Profile → Your data and privacy) deletes events locally and in Supabase. Everything else in local storage is strictly necessary (PECR).
- **Age and sign-up:** onboarding asks "13 or older?" first (`kf2-age`); under-13s get a kind message and nothing is saved. Creating an account needs an explicit "I agree" to the Terms and Privacy Policy (nothing pre-selected).
- **Fonts are bundled** (`@fontsource-variable/*`, SIL OFL) and `public/fonts` for the static pages: no requests to Google Fonts.
- **Every screen size:** compact rules for short screens (phones on their side, flip phones: icon-only tab bar, smaller type) and narrow ones (Fold); on screens 900px+ wide the app sits in a centred phone-shaped column (the body), since everything is positioned against the body.
- **SEO and sharing:** canonical domain `https://knowfeed-nine.vercel.app` in `index.html`, the static pages, `robots.txt` and `sitemap.xml` (change all of them if a custom domain is added). Open Graph and Twitter tags with `public/og-image.png` (1200×630). Each view sets its own `document.title`.
- **Performance:** phrase packs, Series and Fuse.js load as separate files (packs and Series in parallel with the day's data at boot), halving the first download. No source maps are published. The service worker caches the app shell only under `/`, and other pages under their own address.
- **Zoom stays off** (`user-scalable=no`): Jasper confirmed in October 2026 that pinch-to-zoom isn't wanted. Text size follows the iPhone setting.
- **Designed covers (`src/covers.ts`):** poster-style SVG art per topic (globe with flight paths, circuit board, atom, candlestick market, Bauhaus shapes, contour lines, floodlit track, layered skyline, constellation, ringed planet, speech bubbles, isometric blocks). Two palettes per topic, layered glows, grain, sheen and a dark foot for legible text; the seed varies colours and composition so no two match.
- **Photos never look stretched:** `sharpen()` in `cards.ts` measures each photo once it loads; if it would be blown up more than 1.6× its real pixels (common on desktop), it's shown at the largest sharp size, centred over its blurred copy. The story hero sizes from the column (`--colw`), not the window.
- **Cool inventions and fun facts (`funCards` in `pipeline/learn.ts`):** inventions from Wikidata (human inventor P61 plus a date, 20+ language articles, natural things excluded), shown with the year and inventor; fun facts from "Wikipedia:Unusual articles", quoting the intro's most surprising sentence word for word. Four of each a day, none repeated within 6 months (`pipeline/cache/fun.json`, lists refreshed fortnightly). One of each goes into every edition's light mix, and the Learn page lists them.
- **Profile is condensed:** Talk to Knowfeed first, 3 suggestions, the first 10 things you follow, 4 main settings plus Account, and "More settings" and "About, privacy and terms" folded away.

- **Listen mode is gone** (Jasper didn't like it): no Listen section, player or voice setting. Phrase "Hear it" (normal and slow) stays, in `src/audio.ts`.
- **Profile (October 2026):** your name opens **Account and data** (sign-in, forgot/change password, your details, usage stats, back up, restore, delete, legal). "This week" opens **Your week** (`src/recap.ts`). "You follow" is one sideways row with "See all". Legal pages open **inside the app** with a Back button (`src/docs.ts`), and any link to them anywhere in the app does the same.
- **Forgot password:** sign-in failures offer "Forgot my password", and Account has it too. Supabase emails a link back to the site; `src/reset.ts` shows "Choose a new password" (`cloud.recovery`). Expired links show a message (`cloud.linkError`). Needs Supabase Redirect URLs and custom SMTP (SETUP.md), because the built-in sender only reaches team members.
- **Feedback emails:** every note goes to `/api/feedback`, which emails Jasper through Resend (`RESEND_API_KEY`, Vercel only), with the signed-in tester's email (checked with Supabase) as reply-to. Notes that can't send wait in an outbox (`kf2-fb-outbox`).
- **Share a card:** `src/share.ts` draws a branded 4:5 picture on the phone (photo if its host allows, otherwise the designed cover; label, headline, wordmark, address, photo credit) and shows it before sharing. Also for the quiz score and Your week. Loaded only when used.
- **Daily quiz:** `src/dailyquiz.ts`, five questions a day from data only (inventions from Wikidata, On this day years, the pipeline's quizzes), things you read first. A card in editions until done, a row on the done screen, and on Learn. Results in `kf2-dq` and `kf2-dq-history`.
- **Your week:** tiles, a bar per day, comparison with the week before, daily quiz and languages; shareable. The done screen's Sunday/Monday "Your week" line opens it.
- **Language progress** says "phrases met" (started) and "learned for good" (passed the 30-day review), so beginners don't see 0.
- **Notifications (web push):** `src/notify.ts` (Profile → Notifications; needs an account, and on iPhone the Home Screen app), `push_subscriptions` table (with time zone, edition times, quiet hours and today's sends), `pipeline/push.ts` run by `.github/workflows/push.yml` every 15 minutes: sends once per edition within 2 hours of its time, only with new news, never in quiet hours, at most 3 a day; removes dead subscriptions. `sw.js` shows it and opens the app (`?from=push` logs `notification_open`).
- **Body clips (`overflow:clip`):** a merely hidden body could be scrolled by the browser, which slid the app sideways and up during onboarding.
- **Route tests:** every route was driven with Playwright against a test build with a mocked Supabase, with screenshots and videos (see the checklist artifact).

Next: Jasper reviews the first Series; then more (20 skill Series, 5 language scenarios, 3 classic books). Also Google sign-in, tester invites and the admin page. Jasper still needs to add RESEND_API_KEY, the VAPID keys, re-run schema.sql, and set up custom SMTP plus the redirect URL in Supabase. Then Series, and phrase packs for the other languages.
