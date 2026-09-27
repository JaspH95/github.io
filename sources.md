# Knowfeed sources (all free, personal use)

Claude Code:
- **Before first use:** check every URL below returns data. Some feeds move or close.
- **If a URL fails:** find the current replacement on the publisher's site, or drop it. Add a note here.
- **For every source:**
  - Respect each source's terms.
  - Use only what the feed provides (headline, summary, image, link).
  - Always link to the original.

## Outlets people can follow, breaking news and search (live, via /api/news)

The list lives in `api/news.ts` (`OUTLETS`), which the app also reads. Nothing is stored: `/api/news` reads the outlet's own RSS feed when asked and Vercel caches the answer (outlets 10 minutes, breaking 5, search 15). Checked by `npm run check` on every change to `api/`.

- **Breaking:** the front-page feeds marked *breaking* for the reader's country (from their city), grouped by headline. A story leading two or more front pages is "Breaking".
- **Search and typed-in topics:** Google News search (every outlet, headlines and links only) plus the Guardian API.
- **Paywalled** outlets show headlines only, marked "subscription".

| Outlet | Region | Subject | Feed |
|---|---|---|---|
| BBC News (breaking) | uk | news | https://feeds.bbci.co.uk/news/rss.xml |
| Sky News (breaking) | uk | news | https://feeds.skynews.com/feeds/rss/home.xml |
| The Guardian (breaking) | uk | news | https://www.theguardian.com/uk/rss |
| The Independent (breaking) | uk | news | https://www.independent.co.uk/news/uk/rss |
| The Telegraph (paywall) | uk | news | https://www.telegraph.co.uk/rss.xml |
| Evening Standard | uk | news | https://www.standard.co.uk/rss |
| The i Paper | uk | news | https://inews.co.uk/feed |
| Financial Times (paywall) | uk | business | https://www.ft.com/rss/home |
| The Economist (paywall) | uk | business | https://www.economist.com/latest/rss.xml |
| BBC Business | uk | business | https://feeds.bbci.co.uk/news/business/rss.xml |
| Sky Sports | uk | sport | https://www.skysports.com/rss/12040 |
| BBC Sport | uk | sport | https://feeds.bbci.co.uk/sport/rss.xml |
| RTÉ News (breaking) | ie | news | https://www.rte.ie/feeds/rss/?index=/news/ |
| The Irish Times (breaking, paywall) | ie | news | https://www.irishtimes.com/arc/outboundfeeds/feed-irish-news/?outputType=xml |
| ABC News (Australia) (breaking) | au | news | https://www.abc.net.au/news/feed/51120/rss.xml |
| Guardian Australia (breaking) | au | news | https://www.theguardian.com/australia-news/rss |
| NPR (breaking) | us | news | https://feeds.npr.org/1001/rss.xml |
| The New York Times (breaking, paywall) | us | news | https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml |
| CBS News (breaking) | us | news | https://www.cbsnews.com/latest/rss/main |
| CNBC | us | business | https://www.cnbc.com/id/100003114/device/rss/rss.html |
| BBC World (breaking) | world | news | https://feeds.bbci.co.uk/news/world/rss.xml |
| Al Jazeera (breaking) | world | news | https://www.aljazeera.com/xml/rss/all.xml |
| DW (breaking) | world | news | https://rss.dw.com/rdf/rss-en-all |
| France 24 | world | news | https://www.france24.com/en/rss |
| Euronews | world | news | https://www.euronews.com/rss |
| Politico Europe | world | news | https://www.politico.eu/feed/ |
| The Verge | world | tech | https://www.theverge.com/rss/index.xml |
| TechCrunch | world | tech | https://techcrunch.com/feed/ |
| Wired | world | tech | https://www.wired.com/feed/rss |
| Ars Technica | world | tech | https://feeds.arstechnica.com/arstechnica/index |
| Engadget | world | tech | https://www.engadget.com/rss.xml |
| 9to5Mac | world | tech | https://9to5mac.com/feed/ |
| Tom's Hardware | world | tech | https://www.tomshardware.com/feeds/all |
| MacRumors | world | tech | https://feeds.macrumors.com/MacRumors-All |
| 9to5Google | world | tech | https://9to5google.com/feed/ |
| Android Authority | world | tech | https://www.androidauthority.com/feed/ |
| The Register | uk | tech | https://www.theregister.com/headlines.atom |
| TechRadar | world | tech | https://www.techradar.com/rss |
| MIT Technology Review | world | tech | https://www.technologyreview.com/feed/ |
| Rest of World | world | tech | https://restofworld.org/feed/latest/ |
| 404 Media | world | tech | https://www.404media.co/rss/ |
| Hacker News | world | tech | https://hnrss.org/frontpage |
| BBC Technology | uk | tech | https://feeds.bbci.co.uk/news/technology/rss.xml |
| Guardian Technology | uk | tech | https://www.theguardian.com/uk/technology/rss |
| New Scientist | uk | science | https://www.newscientist.com/feed/home/ |
| Nature | world | science | https://www.nature.com/nature.rss |
| Live Science | world | science | https://www.livescience.com/feeds/all |
| ScienceDaily | world | science | https://www.sciencedaily.com/rss/all.xml |
| NASA | world | science | https://www.nasa.gov/news-release/feed/ |
| BBC Science | uk | science | https://feeds.bbci.co.uk/news/science_and_environment/rss.xml |
| BBC Entertainment & Arts | uk | culture | https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml |
| Guardian Culture | uk | culture | https://www.theguardian.com/uk/culture/rss |

Dropped when checked on 27 September 2026: Gizmodo (403 to feed readers), The Washington Post (feed timed out). Reuters and AP have no free feeds.

## World and UK news

| Feed | URL |
|---|---|
| BBC top stories | https://feeds.bbci.co.uk/news/rss.xml |
| BBC World | https://feeds.bbci.co.uk/news/world/rss.xml |
| BBC UK | https://feeds.bbci.co.uk/news/uk/rss.xml |
| BBC Business | https://feeds.bbci.co.uk/news/business/rss.xml |
| The Guardian Open Platform (API, free developer key) | https://content.guardianapis.com/search |

The Guardian API is queried by section (world, uk-news, technology, science, business, sport) with `show-fields=trailText,thumbnail`.

## AI and tech

| Feed | URL |
|---|---|
| BBC Technology | https://feeds.bbci.co.uk/news/technology/rss.xml |
| The Verge | https://www.theverge.com/rss/index.xml |
| Ars Technica | https://feeds.arstechnica.com/arstechnica/index |
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ |
| MIT Technology Review | https://www.technologyreview.com/feed/ |
| Hacker News API (top stories) | https://hacker-news.firebaseio.com/v0/topstories.json |

## CRM and HubSpot (verify these; find current RSS links on each site if they fail)

| Feed | URL |
|---|---|
| HubSpot blog | https://blog.hubspot.com/marketing/rss.xml |
| HubSpot developer changelog | https://developers.hubspot.com/changelog |

## Space and science

| Feed | URL |
|---|---|
| BBC Science & Environment | https://feeds.bbci.co.uk/news/science_and_environment/rss.xml |
| NASA news (verify) | https://www.nasa.gov/news-release/feed/ |
| ~~Space.com~~ (dropped 2026-09-26, see log) | https://www.space.com/feeds/all |
| NASA Astronomy Picture of the Day (API) | https://api.nasa.gov/planetary/apod |

## Money and economics

| Feed | URL |
|---|---|
| BBC Business | https://feeds.bbci.co.uk/news/business/rss.xml |
| Bank of England news (verify) | https://www.bankofengland.co.uk/rss/news |

## Local news by city (BBC regional feeds)

| City | Feed URL |
|---|---|
| London | https://feeds.bbci.co.uk/news/england/london/rss.xml |
| Manchester | https://feeds.bbci.co.uk/news/england/manchester/rss.xml |
| Birmingham | https://feeds.bbci.co.uk/news/england/birmingham_and_black_country/rss.xml |
| Leeds | https://feeds.bbci.co.uk/news/england/leeds_and_west_yorkshire/rss.xml |
| Bristol | https://feeds.bbci.co.uk/news/england/bristol/rss.xml |
| Liverpool | https://feeds.bbci.co.uk/news/england/merseyside/rss.xml |
| Glasgow | https://feeds.bbci.co.uk/news/scotland/glasgow_and_west/rss.xml |
| Edinburgh | https://feeds.bbci.co.uk/news/scotland/edinburgh_east_and_fife/rss.xml |
| Cardiff | https://feeds.bbci.co.uk/news/wales/south_east_wales/rss.xml |
| Belfast | https://feeds.bbci.co.uk/news/northern_ireland/rss.xml |

World cities (New York, Paris, Dublin, Berlin, Dubai, Singapore, Sydney, Toronto) combine two sources:
- **BBC regional feeds:**
  - https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml
  - https://feeds.bbci.co.uk/news/world/europe/rss.xml
  - https://feeds.bbci.co.uk/news/world/middle_east/rss.xml
  - https://feeds.bbci.co.uk/news/world/asia/rss.xml
  - https://feeds.bbci.co.uk/news/world/australia/rss.xml
- **A Guardian API search** for the city name.

## Sport

| Feed | URL |
|---|---|
| Football | https://feeds.bbci.co.uk/sport/football/rss.xml |
| Rugby union | https://feeds.bbci.co.uk/sport/rugby-union/rss.xml |
| Cricket | https://feeds.bbci.co.uk/sport/cricket/rss.xml |
| Tennis | https://feeds.bbci.co.uk/sport/tennis/rss.xml |
| Formula 1 | https://feeds.bbci.co.uk/sport/formula1/rss.xml |
| Golf | https://feeds.bbci.co.uk/sport/golf/rss.xml |
| Boxing | https://feeds.bbci.co.uk/sport/boxing/rss.xml |
| Athletics | https://feeds.bbci.co.uk/sport/athletics/rss.xml |
| Cycling | https://feeds.bbci.co.uk/sport/cycling/rss.xml |
| NFL | https://feeds.bbci.co.uk/sport/american-football/rss.xml |
| Basketball | https://feeds.bbci.co.uk/sport/basketball/rss.xml |

Team feeds follow the pattern https://feeds.bbci.co.uk/sport/football/teams/{team-slug}/rss.xml, for example `west-ham-united` or `arsenal`:
- **Verify** each followed team's feed.
- **If a team feed doesn't exist:** fall back to filtering the football feed by team name.

## Other live scores and results (keys stay on the server)

- **Football (backup only, if API-Football fails):** football-data.org v4.
  - URL: https://api.football-data.org/v4/
  - Uses the `X-Auth-Token` header.
  - The free tier covers the Premier League and other top competitions.
  - Live scores may be delayed on the free tier. That's fine for personal use.
- **Formula 1 results and calendar:** Jolpica-F1.
  - URL: https://api.jolpi.ca/ergast/f1/current.json
  - Results: `.../current/last/results.json`
- **Formula 1:** results only for this build (Jolpica). No live positions.

## Learning (live, factual)

- **Wikipedia daily feed:**
  - URL: https://en.wikipedia.org/api/rest_v1/feed/featured/{YYYY}/{MM}/{DD}
  - One call a day.
  - It includes the featured article, most read, picture of the day, news and on this day.
- **Wikipedia page summary:**
  - URL: https://en.wikipedia.org/api/rest_v1/page/summary/{title}
  - It gives a 2 to 3 sentence extract, a photo and a link.
  - Use it for the topic lists in `content/topics.json`.
- **Wikidata Query Service:** https://query.wikidata.org/sparql, for data-generated quiz questions.
- **Attribution:** Wikipedia text is CC BY-SA. Always show "From Wikipedia" with a link to the article.
- **User-Agent:** send a descriptive User-Agent with a contact email on every Wikimedia request.

## AI summaries (news only, in the pipeline)

- **Google AI Studio (Gemini API, free tier):** https://aistudio.google.com
- **Model:** use a current Flash model that's on the free tier.
- **Rate limits:** check the free-tier limits when building. Summarise at most about 25 new stories per hourly run.

## Live football (replaces football-data.org)

- **API-Football free plan:** https://v3.football.api-sports.io
  - Uses the `x-apisports-key` header.
  - Allows 100 requests a day.
- **Fixtures:** fetch once a day for followed teams.
- **Live:** poll `fixtures?live=all` (or `fixtures?id=`) every 2 to 3 minutes only while a followed team is playing, via `/api/live` with a 2-minute cache.

## Images

- **News:** the feed's own media image (`media:thumbnail` or `media:content`), or the Guardian `thumbnail` field.
- **Learning cards:** the Wikipedia or NASA image. If there isn't one, use the topic's illustrated SVG scene from the prototype.

## Jobs and skills (for onboarding and learning)

- **ESCO (European Skills, Competences, Qualifications and Occupations):**
  - About 3,000 occupations with alternative job titles, descriptions, and links to essential and optional skills. Free to use.
  - Download: https://esco.ec.europa.eu/en/use-esco/download
  - API: https://ec.europa.eu/esco/api
  - Import the English occupations, skills and occupation–skill relations into Supabase once, and refresh when ESCO releases a new version.
  - Show the ESCO attribution in the app's About page.
- **ISCO groups** (included in ESCO): used for the roughly 20 broad job families when nothing matches.

## Interests (free-text search)

- **Guardian tags API:** https://content.guardianapis.com/tags?q={text}&api-key=...
  - Turns any typed interest into a followable news tag.
- **Wikipedia search:** https://en.wikipedia.org/w/api.php?action=opensearch&search={text}
  - Turns an interest into learning topics.
- **Wikidata:** for entity IDs, so "F1", "Formula One" and "Formula 1" become the same interest.

## Cities

- **GeoNames cities** (free, CC BY): https://download.geonames.org/export/dump/ (use `cities15000.zip` for autocomplete).
- **Local news:** map each city to its nearest BBC regional feed, plus a Guardian search by city name.

## Images

- **Article images:** `og:image` from the article page, or `media:content` and `media:thumbnail` in RSS, or the Guardian `thumbnail` field.
- **Wikimedia Commons and Wikipedia page images:**
  - https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=original&titles={title}
  - Check the licence and credit in the image's Commons page metadata.
- **Unsplash API:** https://api.unsplash.com
  - Free with attribution.
  - Rules: use their image URLs, credit the photographer, and trigger the download endpoint when an image is used.
  - Apply for production access before the beta grows.
- **Pexels API:** https://api.pexels.com. Free with attribution.
- **Tools (npm, free):**
  - `smartcrop` for focal-point cropping
  - `blurhash` for placeholders
  - `probe-image-size` to check resolution

## Books

- **Open Library:**
  - Search: https://openlibrary.org/search.json?subject={topic}
  - Covers: https://covers.openlibrary.org/b/id/{cover_id}-L.jpg
  - Used for recommendations only.
- **Project Gutenberg via Gutendex:** https://gutendex.com. For out-of-copyright classics that can be turned into Series.

## Notifications

- **Web Push** with VAPID keys, using the `web-push` npm library, sent from GitHub Actions.
- **iPhone:** web push only works for home-screen web apps on iOS 16.4 or later.

## On-device search

- **Fuse.js** for fuzzy matching of job titles and interests.

## Verification log

- 2026-09-26: The build environment couldn't reach external sites, so no URL was verified at build time. The pipeline writes `public/data/status.json` on every run, listing each source with `ok`, item count and error. Check it after the first run and note replacements here.
- HubSpot developer changelog: the pipeline tries `https://developers.hubspot.com/changelog/rss.xml`, then `.../changelog/rss`. If both fail, it's skipped.
- Wikipedia: if the daily feed at `en.wikipedia.org/api/rest_v1` fails, the pipeline falls back to `api.wikimedia.org/feed/v1`. If page summaries fail, it falls back to the Action API (`w/api.php`, extracts + pageimages).
- 2026-09-26, first pipeline runs on GitHub Actions: 60 of 62 sources returned data.
  - **Space.com: dropped.** The feed returns a valid RSS document with no items for automated readers. Space news still comes from NASA news, BBC Science & Environment and NASA APOD.
  - **HubSpot blog: fixed.** The feed has more XML entities than the parser allows, so entities are now decoded separately. It returns 50 items.
  - **HubSpot developer changelog: working** at `https://developers.hubspot.com/changelog/rss.xml`.
  - **World cities (Toronto, Dublin, Singapore, Dubai, Sydney): few or no stories** until `GUARDIAN_API_KEY` is set. The BBC regional feeds rarely mention those cities by name.
- 2026-09-27, pipeline v2 on GitHub Actions: 151 of 151 sources OK.
  - **BBC Derby: replaced** by `england/derbyshire` (the old path returns 404).
  - **NASA news feed:** its "APOD:" items are skipped, because the picture of the day has its own card.
  - **Guardian:** 21 sections, plus a search for each of 20 world cities. About 750 calls a day, well within the free developer limit.
  - **Gemini:** the newest Flash model can hit its daily free quota; the pipeline then moves to the next Flash or Flash-Lite model.
  - **ESCO:** the API works for walking ISCO groups to occupations (2,909 occupations).
  - **GeoNames `cities15000`:** works (13,036 cities kept).
