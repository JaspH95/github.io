# Knowfeed sources (all free, personal use)

Claude Code:
- **Before first use:** check every URL below returns data. Some feeds move or close.
- **If a URL fails:** find the current replacement on the publisher's site, or drop it. Add a note here.
- **For every source:**
  - Respect each source's terms.
  - Use only what the feed provides (headline, summary, image, link).
  - Always link to the original.

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

London extra:
- **TfL Unified API:** https://api.tfl.gov.uk/Line/Mode/tube,elizabeth-line,dlr,overground/Status
- Show a card only when a line has disruption.

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

## Verification log

- 2026-09-26: The build environment couldn't reach external sites, so no URL was verified at build time. The pipeline writes `public/data/status.json` on every run, listing each source with `ok`, item count and error. Check it after the first run and note replacements here.
- HubSpot developer changelog: the pipeline tries `https://developers.hubspot.com/changelog/rss.xml`, then `.../changelog/rss`. If both fail, it's skipped.
- Wikipedia: if the daily feed at `en.wikipedia.org/api/rest_v1` fails, the pipeline falls back to `api.wikimedia.org/feed/v1`. If page summaries fail, it falls back to the Action API (`w/api.php`, extracts + pageimages).
- 2026-09-26, first pipeline runs on GitHub Actions: 60 of 62 sources returned data.
  - **Space.com: dropped.** The feed returns a valid RSS document with no items for automated readers. Space news still comes from NASA news, BBC Science & Environment and NASA APOD.
  - **HubSpot blog: fixed.** The feed has more XML entities than the parser allows, so entities are now decoded separately. It returns 50 items.
  - **HubSpot developer changelog: working** at `https://developers.hubspot.com/changelog/rss.xml`.
  - **World cities (Toronto, Dublin, Singapore, Dubai, Sydney): few or no stories** until `GUARDIAN_API_KEY` is set. The BBC regional feeds rarely mention those cities by name.
