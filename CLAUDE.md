# Knowfeed (free, personal build, live data only)

Knowfeed is a swipe-to-learn app that replaces mindless scrolling with things worth knowing: AI and tech, CRM and HubSpot, world and local news, space and science, sport, general knowledge, languages and sign language. It's an Instagram-style vertical feed of full-screen cards, and each card opens into a short article.

## Non-negotiables

- **Everything shown is real and live.** No placeholder, sample or made-up content ships. If a source has nothing, the card type simply doesn't appear.
- **Truth comes from sources, not from AI memory.**
  - Learning cards come straight from factual live sources (Wikipedia, NASA and others).
  - News summaries are written by AI only from the article's own text.
- **Zero running cost.** Free tiers only, for personal use.
- **One user** (Jasper, London), used daily on an iPhone as a home-screen web app.

## Reference files

- `knowfeed-prototype.html`: the source of truth for design and behaviour only.
  - Its content is placeholder and must not be reused: hand-written cards, "Sample slot" cards, "Sample live" scores, story update samples, and the left/centre/right coverage bar.
  - Match its look, animations, gestures and flows closely.
- `onboarding-style-reference.png`: the look the onboarding copies.
  - Black screen with a glowing header.
  - Each question types out in the middle of the screen, then drifts upwards and fades.
  - Answers are full-width pill buttons, and chosen answers show in mint.
- `sources.md`: every free feed and API, with how to use each one.

### Design tokens

- **Wordmark:** "Knowfeed" in Bricolage Grotesque 800, followed by a yellow dot (#FFD23F). There is no other logo.
- **Body font:** Instrument Sans. Both fonts come from Google Fonts.
- **Onboarding and settings chat:** pure black with a violet/teal aurora glow. Answers show in #9FF0CF.
- **Topic colours:** each topic has an accent colour (see the `.t-*` classes in the prototype).
- **Cards:** full-screen with a real photo from the source. If there's no photo, use the topic's illustrated scene. Text sits bottom-left and the action buttons sit bottom-right.

## Where every card comes from

### News (world, UK, local, tech, business, science, sport)

- **Sources:** BBC and Guardian feeds, plus the other feeds in `sources.md`.
- **Card:** the outlet's headline, standfirst, photo and time.
- **Read more (AI summary):** a summary written by Gemini from the article's full text.
  - It's generated once per story in the pipeline, never on the phone.
  - It's labelled "Summary by AI from [Outlet]" and always has a "Read the full story" link.
- **Source check:** the real list and count of outlets covering the same story.

### General knowledge, from Wikipedia's daily feed

One call per day gives the following, each with the article's summary and photo:
- "On this day" events
- the featured article
- the most-read articles
- the picture of the day

### Space

- NASA Astronomy Picture of the Day, with NASA's own explanation.
- Wikipedia summaries of space topics.

### Learning topics (AI, future tech, CRM, psychology, money, sign language, science, culture)

- **Curated lists:** a list of Wikipedia article titles per topic lives in `content/topics.json`. Claude Code writes the first list; Jasper can edit it.
- **Live content:** each run fetches the live Wikipedia summary and image for a few titles. The wording is Wikipedia's, not AI's.
- **Attribution:** show "From Wikipedia (CC BY-SA)" with a link.

### HubSpot

- The HubSpot developer changelog and HubSpot blog, as cards with headline, summary and link.
- **Try it at work:** changelog items are tagged "New in HubSpot: try it".

### Quizzes (generated from data, never invented)

- **From Wikipedia "On this day":** "In which year did [event] happen?" The correct year comes from the source, and the wrong answers are nearby years.
- **From Wikidata:** simple facts (for example capitals, planets, element symbols), where both the question and answer come from the data.

### Sport

- **News and results:** BBC Sport feeds per sport, plus team feeds for followed teams.
- **Live football:** API-Football free plan for the followed team.
  - Fetch fixtures once a day.
  - Poll every 2 to 3 minutes only while the team's match is live, which stays within 100 requests a day.
  - The live card shows only when a match is actually on. It becomes a result card at full time.
- **Formula 1:** results and calendar via Jolpica-F1 after each session. No live positions.

### Languages

Phrase packs are the one fixed content type. Everything else is live.

- **Files:** one pack per language in `content/phrases/<language>.json`.
- **Languages:** Spanish, French, Italian, German, Portuguese, Romanian and Japanese.
- **Size:** at least 100 phrases per language to start (aim for about 120 so weak ones can be cut).
- **Written by:** Claude Code at build time.
- **Themes (roughly 10 to 12 phrases each):**
  1. greetings and introductions
  2. polite basics
  3. café and restaurant
  4. shopping and money
  5. getting around
  6. family and friends
  7. at home
  8. feelings and small talk
  9. work
  10. time, numbers and days
  11. problems and help
- **Order:** from easiest to harder, starting with the most useful everyday phrases.
- **Checking:**
  - Every phrase has a `checked` flag.
  - Mark phrases as checked once a native speaker confirms them, and record who checked them in the `notes` field.
  - Unchecked phrases still appear in the app, with a small "Not yet checked" label on the card and in the phrase pack view.
  - The label disappears once `checked` is true.
  - Never hide or delay phrases because they're unchecked.

### Phrase schema

```json
{
  "id": "ro-001",
  "phrase": "Mulțumesc",
  "romanisation": "only for Japanese, e.g. Arigatō gozaimasu",
  "say": "mool-tsoo-MESK",
  "meaning": "Thank you",
  "when": "One short line on when to use it",
  "theme": "polite-basics",
  "level": 1,
  "formality": "neutral | informal | formal",
  "notes": "e.g. gender or formal/informal forms, who checked it",
  "checked": false
}
```

### How phrases are taught (no AI)

- **Phrase of the day:** one new phrase a day per language, shown near the top of the feed.
- **Hear it:** each phrase can be played at normal and slow speed using the device voice for that language.
- **Review cards (spaced repetition):** a phrase you've seen comes back as a "Remember this?" card.
  - The card shows the meaning, and you tap to reveal the phrase. Then tap "Got it" or "Not yet".
  - Reviews are scheduled after 1, 3, 7, 14 and 30 days.
  - "Not yet" sends the phrase back to the 1-day step.
  - After passing the 30-day review, the phrase counts as learned.
  - Show at most 3 review cards a day per language, spread through the feed.
- **Tracking:** progress is stored on the device (seen date, step, learned). A small line shows progress, such as "Romanian: 42 learned of 120".
- **When a pack runs out:** after about 100 days all new phrases have been seen and reviews carry on for a while.
  - The settings chat then offers "Pack finished: review everything again" or "Ask for a new pack".
  - The next pack is made the same way and dropped into the folder.
- **Japanese:** shows the kana and kanji, plus romanisation and the pronunciation guide.

### BSL

- The animated vowel card (thumb A, then E, I, O, U across the fingertips) is real and stays.
- Plus Wikipedia summaries about BSL and Deaf culture.
- No other sign animations until they've been made or checked by Deaf BSL teachers.

## Features to build

### Feed

- **Layout:** a vertical snap-scrolling feed, rebuilt fresh every time the app opens from the latest data.
- **Card types:**
  - news
  - learning (Wikipedia/NASA)
  - on this day
  - quiz (data-generated)
  - HubSpot update
  - phrase of the day
  - phrase review
  - sign of the day
  - live football
  - result
  - story update
  - discover (a suggested new topic)
- **Like:** a button, or a double tap with a heart burst. Liking a card pulls the next card on the same topic up the feed.
- **Read later:** saved cards appear first on the next open and are cleared once read.
- **Read more:** opens the full article view.
- **Ordering:** weighted by topic interest, never the same topic twice in a row. Discover cards sit around positions 6 and 13.
- **Top of the feed, in this order:**
  1. live football
  2. phrase and sign of the day
  3. updates on followed stories
  4. read-later items

### Article view

- **News:**
  - photo
  - headline
  - outlet
  - time
  - the AI summary (3 short sections where the text supports them: what happened, why it matters, what happens next)
  - "Also covered by"
  - Source check
  - "Read the full story"
- **Learning:** photo, title, the Wikipedia or NASA text, a link to the source, and attribution.
- **Tools:** Listen (device text-to-speech) and Follow story (news only).
- **Getting back to the feed:**
  - a back button fixed at the top-left that stays visible while scrolling
  - pulling down from the top of the article
  - swiping right
- A Like and Read later bar is pinned to the bottom.

### Onboarding and the settings chat

- Keep these exactly as in the prototype. Both run on the device with no AI.
- **Onboarding questions, in order:**
  1. name
  2. major city
  3. work area
  4. topics
  5. sports (and football teams)
  6. languages
  7. topics to hide
  8. daily scroll time
- **No skip button.**
- **Keyboard:** the text box sits directly under the question, so the question is always visible when the keyboard is open.
- **Settings chat options:**
  - Suggest something new (rule-based, using the `RELATED` map)
  - Change my topics
  - Change my city
  - Sports and teams
  - Languages
  - Back to my feed

### Other features

- **Listen mode:** reads the feed aloud card by card using the Web Speech API, with a mini player (pause, next, stop) and a British voice where available.
- **Work list:** save HubSpot "try it" items and tick them off.
- **Export and import:** likes, saves, follows and settings as a JSON file.

### Removed on purpose (don't build)

- Explain simpler
- Why am I seeing this
- AI chat or any AI on the phone
- The left/centre/right coverage bar
- Hand-written learning cards, myths, and try-at-work cards (phrase packs are the only fixed content)
- Live scores for sports other than football
- Push notifications
- Accounts and cloud sync

## Free architecture

- **App:** a static PWA built with Vite and TypeScript. Port the prototype's HTML, CSS and JS into modules rather than redesigning it. It needs a manifest and icons so it installs to the iPhone home screen, and a service worker that caches the latest feed for offline use (on the Tube).
- **Hosting:** Vercel Hobby (free) connected to a private GitHub repo. Every push redeploys.
- **Pipeline:** a GitHub Actions workflow on a cron, hourly.
  - A private repo has 2,000 free minutes a month.
  - Each run:
    1. fetches every source
    2. removes duplicates and groups stories by title similarity
    3. gets full text for new stories (see below)
    4. makes AI summaries for new stories only
    5. refreshes Wikipedia and NASA content
    6. builds data-generated quizzes
    7. writes `public/data/*.json`
    8. commits only if something changed
  - Vercel redeploys on each commit.
- **Full text for summaries:**
  - Use the Guardian API `body` field.
  - For other outlets, fetch the article page and extract the text with Mozilla Readability.
  - Use full text only as input to the summary. Never store or display it.
  - Respect robots.txt.
  - If extraction fails, show the standfirst only.
- **AI summaries (Gemini free tier):**
  - Use a current Gemini Flash model available on the free tier.
  - Summarise at most about 25 new stories per run, to stay inside free daily limits.
  - Cache by URL so no story is summarised twice.
  - Send only public article text, never personal data. Google may use free-tier inputs to improve its products.
- **Live football:** a Vercel serverless function at `/api/live` holds the API-Football key.
  - The phone polls it every 2 to 3 minutes only while a followed team's match is in play.
  - Cache for 2 minutes so the phone never exceeds the free quota.
- **London Tube status:** `/api/tfl`, cached for 60 seconds. A card appears only when a line has disruption.
- **Storage:** everything personal lives in the browser (localStorage or IndexedDB), as in the prototype.
- **Wikimedia etiquette:** send a descriptive User-Agent with a contact email, and keep requests modest.

### Secrets

These are all free keys, kept in GitHub Actions secrets and Vercel environment variables. Never commit them or expose them in the browser.

- `GEMINI_API_KEY` (Google AI Studio)
- `GUARDIAN_API_KEY` (The Guardian Open Platform, developer key)
- `API_FOOTBALL_KEY` (API-Football free plan)
- `NASA_API_KEY` (api.nasa.gov)
- `TFL_APP_KEY` (optional)

## AI summary prompt (pipeline only)

Use this, or something very close:

> Summarise this news article for a busy reader. Use only information in the article text below. Do not add facts, names, numbers or context that aren't in the text. Write in British English, in plain, short sentences. Give up to three short sections with these headings, skipping any the text doesn't support: "What happened", "Why it matters", "What happens next". Maximum 150 words. Do not quote more than 10 words in a row from the article.

- Store the result as JSON with `sections` and `model`.
- If the output mentions anything not in the text, or the call fails, fall back to the standfirst.

## Build order

1. **Port the prototype** to Vite and TypeScript as a PWA with identical design. Deploy to Vercel and install it on the iPhone.
2. **News pipeline:**
   - GitHub Actions with BBC and Guardian first.
   - Real news cards, "Also covered by", Source check and Read the full story.
3. **AI summaries** with Gemini, with caching and fallbacks.
4. **Learning:**
   - the Wikipedia daily feed
   - NASA APOD
   - Wikipedia topic lists
   - data-generated quizzes
   - the HubSpot changelog and blog
5. **Local news** (city feeds plus TfL for London), then Follow story.
6. **Sport:** BBC Sport feeds, team feeds, and live football via `/api/live`. F1 results via Jolpica.
7. **Languages:**
   - Write the phrase packs, 100+ per language, following the phrase schema.
   - Add phrase of the day, review cards and progress tracking.
   - Before writing each pack, show Jasper 20 sample phrases for approval.
8. **Polish:** Listen mode, export and import, offline caching. Remove every trace of prototype placeholder content.
9. **Use it daily for two weeks,** then decide what's next.

## Before calling a step done

- Test on an iPhone-sized screen (390×844), including the keyboard in onboarding and the settings chat.
- Check every source returns data. Replace or remove any that fail and note it in `sources.md`.
- If a source or API is down, skip it quietly and show the rest.
- Search the UI for "sample", "placeholder", "Rivals FC" and "Driver A". None should remain.
