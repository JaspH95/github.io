/* Knowfeed pipeline: runs hourly on GitHub Actions and writes public/data/*.json
   npm run pipeline                       everything
   npm run pipeline -- --only=news        one part: news | local | sport | learning | images
   npm run pipeline -- --record           also save every response to fixtures/
   OFFLINE=1 npm run pipeline             replay the saved responses with no internet */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getFeed, fresh, type FeedItem } from './rss';
import { guardianSearch, guardianBody } from './guardian';
import { merge, publicStory, setInterests, type Bucket, type Stored } from './stories';
import { readPage, htmlToText } from './fulltext';
import { Summariser, type Source } from './summarise';
import { enrich, pruneEntities, type EntityCache } from './entities';
import { chooseImages, pruneImages, imageStats, type ImageCache } from './images';
import { wikipediaDaily, topicCards, apod, wikidataQuizzes, hubspot, growPools, didYouKnow, funCards, type LearnPool, type FactPool, type FunPool } from './learn';
import { NEWS_FEEDS, GUARDIAN_SECTIONS, BBC_REGIONS, WORLD_CITIES, SPORT_FEEDS, TEAM_SLUGS } from './sources';
import { fetchJSON, record, status, hash, todayUTC, pool } from './util';
import { OFFLINE, RECORD } from './http';
import type { NewsFile, LocalFile, SportFile, LearnFile, StatusFile, F1Data, InterestsFile } from '../src/types';

const OUT = 'public/data';
const CACHE = 'pipeline/cache';
const MAX_SUMMARIES = Number(process.env.MAX_SUMMARIES || 25);
/* Local regions summarised first (the rest keep the outlet's standfirst). Comma-separated region ids. */
const PRIORITY_REGIONS = (process.env.PRIORITY_REGIONS || 'london').split(',').map(s => s.trim()).filter(Boolean);

const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
const want = (part: string) => !only || only.split(',').includes(part);

interface Store { news: Bucket; local: Record<string, Bucket>; sport: Record<string, Bucket>; teams: Record<string, Bucket>; f1?: F1Data }

async function readJSON<T>(path: string, fallback: T): Promise<T> {
  try { return existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : fallback; } catch { return fallback; }
}

/* ---------- Fetching ---------- */

async function newsItems(): Promise<{ items: FeedItem[]; front: Set<string> }> {
  const items: FeedItem[] = [];
  const front = new Set<string>();
  await pool(NEWS_FEEDS, 4, async f => {
    const got = fresh(await getFeed(f.name, f.url, f.outlet), 36, 30);
    // The first few stories on BBC News's front page count as "leading the news"
    if (f.front) got.filter(i => (i.pos ?? 99) < 6).forEach(i => front.add(i.url));
    items.push(...got.map(i => ({ ...i, topic: f.topic, tags: f.tags })));
  });
  await pool(GUARDIAN_SECTIONS, 2, async g => {
    const got = await guardianSearch(`section=${g.section}`, `Guardian: ${g.section}`, { topic: g.topic, tags: g.tags });
    items.push(...fresh(got, 36, 25));
  });
  return { items, front };
}

async function localItems(store: Store) {
  await pool(BBC_REGIONS, 4, async r => {
    const got = fresh(await getFeed(`BBC local: ${r.name}`, r.url, 'BBC News'), 72, 25);
    store.local[r.id] ||= { stories: [] };
    merge(store.local[r.id], got.map(i => ({ ...i, topic: 'local' as const })), { topic: 'local', tag: r.name, keepHours: 72 });
  });
  const regionFeeds = new Map<string, Promise<FeedItem[]>>();
  await pool(WORLD_CITIES, 2, async c => {
    if (!regionFeeds.has(c.feed)) regionFeeds.set(c.feed, getFeed(`BBC world region: ${c.feed.split('/world/')[1]?.split('/')[0]}`, c.feed, 'BBC News'));
    const region = (await regionFeeds.get(c.feed)!).filter(i => c.words.test(`${i.title} ${i.summary}`));
    const g = await guardianSearch(`q=${encodeURIComponent(`"${c.guardian}"`)}`, `Guardian search: ${c.name}`, {}, 20);
    store.local[c.id] ||= { stories: [] };
    merge(store.local[c.id], fresh([...region, ...g], 72, 30).map(i => ({ ...i, topic: 'local' as const })), { topic: 'local', tag: c.name, keepHours: 72 });
  });
}

async function f1(): Promise<F1Data | undefined> {
  const out: F1Data = {};
  const lastUrl = 'https://api.jolpi.ca/ergast/f1/current/last/results.json';
  const calUrl = 'https://api.jolpi.ca/ergast/f1/current.json';
  try {
    const r = await fetchJSON<any>(lastUrl);
    const race = r.MRData?.RaceTable?.Races?.[0];
    if (race) out.last = {
      race: race.raceName, round: +race.round, date: race.date, url: race.url,
      results: (race.Results || []).slice(0, 10).map((x: any) => ({ pos: +x.position, driver: `${x.Driver.givenName} ${x.Driver.familyName}`, team: x.Constructor?.name || '', detail: x.Time?.time || x.status || '' })),
    };
    record('Jolpica F1 last results', lastUrl, !!race, race ? 1 : 0);
  } catch (e: any) { record('Jolpica F1 last results', lastUrl, false, 0, e?.message); }
  try {
    const r = await fetchJSON<any>(calUrl);
    const races = r.MRData?.RaceTable?.Races || [];
    const nx = races.find((x: any) => x.date >= todayUTC());
    if (nx) out.next = { race: nx.raceName, round: +nx.round, date: nx.date, ...(nx.time ? { time: nx.time } : {}), circuit: nx.Circuit?.circuitName || '', locality: nx.Circuit?.Location?.locality || '', country: nx.Circuit?.Location?.country || '', url: nx.url };
    record('Jolpica F1 calendar', calUrl, races.length > 0, races.length);
  } catch (e: any) { record('Jolpica F1 calendar', calUrl, false, 0, e?.message); }
  return out.last || out.next ? out : undefined;
}

async function sportItems(store: Store) {
  await pool(Object.entries(SPORT_FEEDS), 4, async ([name, url]) => {
    const got = fresh(await getFeed(`BBC Sport: ${name}`, url, 'BBC Sport'), 48, 25);
    store.sport[name] ||= { stories: [] };
    merge(store.sport[name], got.map(i => ({ ...i, topic: 'sport' as const })), { topic: 'sport', tag: name, keepHours: 48 });
  });
  await pool(Object.entries(TEAM_SLUGS), 4, async ([team, slug]) => {
    const got = fresh(await getFeed(`BBC Sport team: ${team}`, `https://feeds.bbci.co.uk/sport/football/teams/${slug}/rss.xml`, 'BBC Sport'), 96, 12);
    store.teams[team] ||= { stories: [] };
    merge(store.teams[team], got.map(i => ({ ...i, topic: 'sport' as const })), { topic: 'sport', tag: team, keepHours: 96 });
  });
  const f = await f1();
  if (f) store.f1 = f;
}

/* ---------- AI summaries: new or changed stories, most important first ---------- */

function needsSummary(s: Stored): boolean {
  if (s.summary) return s.articles.length >= s.summary.n + 2 && Date.now() - +new Date(s.summary.at) > 3 * 3600_000;
  if (s._.sumFail === 'perm') return false;
  return true;
}

async function textFor(url: string, outlet: string): Promise<string | null> {
  const body = guardianBody.get(url);
  if (body) return htmlToText(body);
  if (outlet === 'The Guardian') return null; // live blogs and the like
  return (await readPage(url))?.text ?? null;
}

async function summaries(store: Store, entityCache: EntityCache): Promise<StatusFile['summaries']> {
  const stats: StatusFile['summaries'] = { made: 0, cached: 0, failed: 0, skipped: 0 };
  const all: Stored[] = [
    ...store.news.stories,
    ...Object.values(store.teams).flatMap(b => b.stories),
    ...PRIORITY_REGIONS.flatMap(r => store.local[r]?.stories || []),
    ...Object.values(store.sport).flatMap(b => b.stories),
  ];
  stats.cached = all.filter(s => s.summary).length;
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.log('GEMINI_API_KEY not set: skipping AI summaries (stories show the standfirst)'); return stats; }
  const sum = new Summariser(key);
  await sum.init();
  // News by importance, then everything else by freshness
  const newsIds = new Set(store.news.stories.map(s => s.id));
  const todo = [...new Map(all.filter(needsSummary).map(s => [s.id, s])).values()]
    .sort((a, b) => (newsIds.has(b.id) ? 1 : 0) - (newsIds.has(a.id) ? 1 : 0) || b.importance - a.importance || +new Date(b.updated) - +new Date(a.updated));
  stats.skipped = Math.max(0, todo.length - MAX_SUMMARIES);
  for (const s of todo.slice(0, MAX_SUMMARIES)) {
    if (!sum.available.length) { stats.skipped! += 1; continue; }
    const sources: Source[] = [];
    for (const a of s.articles.slice(0, 6)) {
      if (sources.length >= 5) break;
      const t = await textFor(a.url, a.outlet);
      if (t && t.length > 400) sources.push({ outlet: a.outlet, title: a.title, text: t, url: a.url });
    }
    s._.sumTried = new Date().toISOString();
    if (!sources.length) { s._.sumFail = 'perm'; stats.failed++; console.log(`  no readable text: ${s.title}`); continue; }
    const r = await sum.run(s.title, sources);
    if (r === 'transient') { s._.sumFail = 'transient'; stats.skipped! += 1; continue; }
    if (r === 'failed') { if (!s.summary) s._.sumFail = 'perm'; stats.failed++; continue; }
    s.summary = r.summary; delete s._.sumFail;
    s.entities = await enrich(r.entities, entityCache);
    stats.made++;
  }
  stats.model = [...sum.used].join(', ') || undefined;
  if (sum.notes.length) stats.notes = [...new Set(sum.notes)];
  return stats;
}

/* ---------- Learning ---------- */

async function learn(interests: InterestsFile): Promise<LearnFile> {
  const now = new Date();
  const date = todayUTC(now);
  const extra = JSON.parse(await readFile('content/topics.json', 'utf8'));
  // The version string forces a rebuild when the way cards are chosen changes (v2: growing pools, 5 a day)
  const topicsHash = hash(JSON.stringify(['v9', interests.interests.map(i => [i.id, i.wiki]), extra]));
  const path = `${OUT}/learn.json`;
  const old = await readJSON<LearnFile | null>(path, null);
  const hub = await hubspot();
  // Wikipedia, NASA and Wikidata: once a day (or when the topic lists change)
  if (old && old.date === date && old.topicsHash === topicsHash && old.cards.length) {
    console.log('Learning content already fresh for today');
    return { ...old, generated: now.toISOString(), hubspot: hub.length ? hub : old.hubspot };
  }
  const daily = await wikipediaDaily(now);
  const pools = await growPools(interests.interests, await readJSON<LearnPool>(`${CACHE}/learnpool.json`, {}), now);
  await writeFile(`${CACHE}/learnpool.json`, JSON.stringify(pools) + '\n');
  const topicList = await topicCards(interests.interests, extra, now, pools);
  const dyk = await didYouKnow(await readJSON<FactPool>(`${CACHE}/facts.json`, { hooks: [] }), now);
  await writeFile(`${CACHE}/facts.json`, JSON.stringify(dyk.pool) + '\n');
  const fun = await funCards(await readJSON<FunPool | null>(`${CACHE}/fun.json`, null), now);
  await writeFile(`${CACHE}/fun.json`, JSON.stringify(fun.pool) + '\n');
  const pic = await apod();
  const wd = await wikidataQuizzes(now);
  const cards = [...daily.cards, ...(pic ? [pic] : []), ...dyk.cards, ...fun.cards, ...topicList];
  return { generated: now.toISOString(), date, topicsHash, cards, quizzes: [...daily.quizzes, ...wd], hubspot: hub.length ? hub : old?.hubspot || [] };
}

/* ---------- Output ---------- */

const strip = (o: any) => JSON.stringify({ ...o, generated: undefined });
async function writeIfChanged(name: string, data: any) {
  const path = `${OUT}/${name}`;
  const old = await readJSON<any>(path, null);
  if (old && strip(old) === strip(data)) { console.log(`unchanged ${name}`); return; }
  await writeFile(path, JSON.stringify(data) + '\n');
  console.log(`wrote ${name}`);
}

const byRank = (a: Stored, b: Stored) => b.importance - a.importance || +new Date(b.updated) - +new Date(a.updated);
const recent = (a: Stored, b: Stored) => +new Date(b.updated) - +new Date(a.updated);

async function main() {
  if (OFFLINE) console.log('OFFLINE: replaying recorded responses from fixtures/');
  if (RECORD) console.log('RECORD: saving every response to fixtures/');
  await mkdir(OUT, { recursive: true });
  await mkdir(CACHE, { recursive: true });
  const interests = JSON.parse(await readFile('content/interests.json', 'utf8')) as InterestsFile;
  setInterests(interests.interests);

  const store = await readJSON<Store>(`${CACHE}/stories.json`, { news: { stories: [] }, local: {}, sport: {}, teams: {} });
  const entityCache = await readJSON<EntityCache>(`${CACHE}/entities.json`, {});
  const imageCache = await readJSON<ImageCache>(`${CACHE}/images.json`, {});

  if (want('news')) {
    const { items, front } = await newsItems();
    merge(store.news, items, { topic: 'news', keepHours: 48, frontUrls: front });
  }
  if (want('local')) await localItems(store);
  if (want('sport')) await sportItems(store);

  const sum = (want('news') || want('local') || want('sport')) ? await summaries(store, entityCache) : { made: 0, cached: 0, failed: 0 };

  if (want('news') || want('local') || want('sport') || want('images')) {
    // Stock photo searches use the story's first interest
    const label = new Map(interests.interests.map(i => [i.id, i.label]));
    const q = (s: Stored) => s.tags.map(t => label.get(t)).find(Boolean) || s.tag;
    await chooseImages([...store.news.stories].sort(byRank), imageCache, 120, q);
    await chooseImages([...Object.values(store.teams), ...Object.values(store.sport)].flatMap(b => b.stories).sort(recent), imageCache, 40, q);
    await chooseImages(Object.values(store.local).flatMap(b => b.stories).sort(recent), imageCache, 60, q);
  }

  const now = new Date().toISOString();
  if (want('news')) await writeIfChanged('news.json', { generated: now, stories: [...store.news.stories].sort(byRank).slice(0, 220).map(publicStory) } satisfies NewsFile);
  if (want('local')) {
    const regions: LocalFile['regions'] = {};
    for (const [id, b] of Object.entries(store.local)) regions[id] = [...b.stories].sort(recent).slice(0, 20).map(publicStory);
    await writeIfChanged('local.json', { generated: now, regions } satisfies LocalFile);
  }
  if (want('sport')) {
    const pub = (r: Record<string, Bucket>, n: number) => Object.fromEntries(Object.entries(r).map(([k, b]) => [k, [...b.stories].sort(recent).slice(0, n).map(publicStory)]));
    await writeIfChanged('sport.json', { generated: now, sports: pub(store.sport, 20), teams: pub(store.teams, 10), ...(store.f1 ? { f1: store.f1 } : {}) } satisfies SportFile);
  }
  if (want('learning')) await writeIfChanged('learn.json', await learn(interests));

  pruneEntities(entityCache); pruneImages(imageCache);
  await writeFile(`${CACHE}/stories.json`, JSON.stringify(store) + '\n');
  await writeFile(`${CACHE}/entities.json`, JSON.stringify(entityCache) + '\n');
  await writeFile(`${CACHE}/images.json`, JSON.stringify(imageCache) + '\n');
  if (existsSync(`${CACHE}/summaries.json`)) await rm(`${CACHE}/summaries.json`); // replaced by summaries stored on each story

  // A partial run keeps the other parts' source results from the last full run
  const prev = await readJSON<StatusFile | null>(`${OUT}/status.json`, null);
  const names = new Set(status.map(s => s.name));
  const sources = [...status, ...(only && prev ? prev.sources.filter(s => !names.has(s.name)) : [])];
  await writeIfChanged('status.json', { generated: now, sources, summaries: sum, images: imageStats } satisfies StatusFile);

  const failed = status.filter(s => !s.ok);
  console.log(`\n${status.length - failed.length}/${status.length} sources OK, summaries: ${JSON.stringify(sum)}, images: ${JSON.stringify(imageStats)}`);
  if (failed.length) console.log('Failed:\n' + failed.map(f => `  ${f.name}: ${f.error || ''} ${f.url}`).join('\n'));
}

main().catch(e => { console.error(e); process.exit(1); });
