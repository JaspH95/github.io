/* Knowfeed pipeline: runs hourly on GitHub Actions and writes public/data/*.json */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getFeed, toStory, fresh, type FeedItem } from './rss';
import { cluster } from './cluster';
import { extractText, htmlToText } from './fulltext';
import { pickModel, summarise } from './summarise';
import { wikipediaDaily, topicCards, apod, wikidataQuizzes, hubspot } from './learn';
import { NEWS_FEEDS, GUARDIAN_SECTIONS, UK_CITIES, WORLD_CITIES, SPORT_FEEDS, TEAM_SLUGS } from './sources';
import { fetchJSON, record, status, hash, normaliseUrl, clip, stripHtml, todayUTC, pool } from './util';
import type { Story, NewsFile, LocalFile, SportFile, LearnFile, StatusFile, F1Data, TopicKey, Summary } from '../src/types';

const OUT = 'public/data';
const CACHE = 'pipeline/cache/summaries.json';
const MAX_SUMMARIES = Number(process.env.MAX_SUMMARIES || 25);
const PRIORITY_CITY = process.env.PRIORITY_CITY || 'London';

/* Guardian article bodies, kept in memory only as input for summaries */
const guardianBody = new Map<string, string>();

async function guardian(params: string, label: string): Promise<FeedItem[]> {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return [];
  const url = `https://content.guardianapis.com/search?${params}&show-fields=trailText,thumbnail,body&page-size=20&order-by=newest&api-key=${key}`;
  try {
    const r = await fetchJSON<any>(url);
    const items: FeedItem[] = (r.response?.results || []).filter((x: any) => x.type === 'article').map((x: any) => {
      const u = normaliseUrl(x.webUrl);
      if (x.fields?.body) guardianBody.set(u, x.fields.body);
      return { title: stripHtml(x.webTitle), url: u, summary: clip(stripHtml(x.fields?.trailText || '')), image: x.fields?.thumbnail, published: x.webPublicationDate, outlet: 'The Guardian' };
    });
    record(label, url.replace(key, '***'), items.length > 0, items.length);
    return items;
  } catch (e: any) {
    record(label, url.replace(key, '***'), false, 0, e?.message);
    return [];
  }
}

async function hackerNews(): Promise<Story[]> {
  const url = 'https://hacker-news.firebaseio.com/v0/topstories.json';
  try {
    const ids: number[] = (await fetchJSON<number[]>(url)).slice(0, 15);
    const items = await pool(ids, 5, id => fetchJSON<any>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null));
    const stories = items.filter(i => i && i.url && i.title && i.type === 'story').map((i: any): Story => ({
      id: hash(i.url), title: i.title,
      standfirst: `${i.score} points and ${i.descendants || 0} comments on Hacker News. From ${new URL(i.url).hostname.replace(/^www\./, '')}.`,
      url: normaliseUrl(i.url), outlet: 'Hacker News', published: new Date(i.time * 1000).toISOString(), topic: 'tech', also: [],
    }));
    record('Hacker News top stories', url, stories.length > 0, stories.length);
    return stories;
  } catch (e: any) {
    record('Hacker News top stories', url, false, 0, e?.message);
    return [];
  }
}

async function news(): Promise<Story[]> {
  const byTopic = new Map<TopicKey, Story[]>();
  const add = (t: TopicKey, xs: Story[]) => byTopic.set(t, [...(byTopic.get(t) || []), ...xs]);
  await pool(NEWS_FEEDS, 4, async f => add(f.topic, fresh(await getFeed(f.name, f.url, f.outlet), 36, 25).map(i => toStory(i, f.topic))));
  await pool(GUARDIAN_SECTIONS, 2, async g => add(g.topic, fresh(await guardian(`section=${g.section}`, `Guardian: ${g.section}`), 36, 20).map(i => toStory(i, g.topic))));
  add('tech', await hackerNews());
  // Group across outlets within each topic, then across topics so one story appears once
  const clustered = cluster([...byTopic.entries()].flatMap(([, xs]) => cluster(xs)).sort((a, b) => b.also.length - a.also.length));
  return clustered.sort((a, b) => +new Date(b.published) - +new Date(a.published)).slice(0, 160);
}

async function local(): Promise<Record<string, Story[]>> {
  const cities: Record<string, Story[]> = {};
  await pool(Object.entries(UK_CITIES), 4, async ([city, url]) => {
    cities[city] = cluster(fresh(await getFeed(`BBC local: ${city}`, url, 'BBC'), 72, 20).map(i => toStory(i, 'local', city)));
  });
  const regionCache = new Map<string, Promise<FeedItem[]>>();
  await pool(Object.entries(WORLD_CITIES), 2, async ([city, def]) => {
    if (!regionCache.has(def.feed)) regionCache.set(def.feed, getFeed(`BBC region: ${def.feed.split('/world/')[1]?.split('/')[0]}`, def.feed, 'BBC'));
    const region = (await regionCache.get(def.feed)!).filter(i => def.words.test(i.title + ' ' + i.summary));
    const g = await guardian(`q=${encodeURIComponent(`"${city}"`)}`, `Guardian search: ${city}`);
    cities[city] = cluster(fresh([...region, ...g], 72, 20).map(i => toStory(i, 'local', city)));
  });
  return cities;
}

async function f1(): Promise<F1Data | undefined> {
  const out: F1Data = {};
  try {
    const r = await fetchJSON<any>('https://api.jolpi.ca/ergast/f1/current/last/results.json');
    const race = r.MRData?.RaceTable?.Races?.[0];
    if (race) out.last = {
      race: race.raceName, round: +race.round, date: race.date, url: race.url,
      results: (race.Results || []).slice(0, 10).map((x: any) => ({ pos: +x.position, driver: `${x.Driver.givenName} ${x.Driver.familyName}`, team: x.Constructor?.name || '', detail: x.Time?.time || x.status || '' })),
    };
    record('Jolpica F1 last results', 'https://api.jolpi.ca/ergast/f1/current/last/results.json', !!race, race ? 1 : 0);
  } catch (e: any) { record('Jolpica F1 last results', 'https://api.jolpi.ca/ergast/f1/current/last/results.json', false, 0, e?.message); }
  try {
    const r = await fetchJSON<any>('https://api.jolpi.ca/ergast/f1/current.json');
    const races = r.MRData?.RaceTable?.Races || [];
    const today = todayUTC();
    const nx = races.find((x: any) => x.date >= today);
    if (nx) out.next = { race: nx.raceName, round: +nx.round, date: nx.date, ...(nx.time ? { time: nx.time } : {}), circuit: nx.Circuit?.circuitName || '', locality: nx.Circuit?.Location?.locality || '', country: nx.Circuit?.Location?.country || '', url: nx.url };
    record('Jolpica F1 calendar', 'https://api.jolpi.ca/ergast/f1/current.json', races.length > 0, races.length);
  } catch (e: any) { record('Jolpica F1 calendar', 'https://api.jolpi.ca/ergast/f1/current.json', false, 0, e?.message); }
  return out.last || out.next ? out : undefined;
}

async function sport(): Promise<SportFile> {
  const sports: Record<string, Story[]> = {}, teams: Record<string, Story[]> = {};
  await pool(Object.entries(SPORT_FEEDS), 4, async ([s, url]) => {
    sports[s] = cluster(fresh(await getFeed(`BBC Sport: ${s}`, url, 'BBC Sport'), 48, 20).map(i => toStory(i, 'sport', s)));
  });
  await pool(Object.entries(TEAM_SLUGS), 4, async ([team, slug]) => {
    const url = `https://feeds.bbci.co.uk/sport/football/teams/${slug}/rss.xml`;
    teams[team] = fresh(await getFeed(`BBC Sport team: ${team}`, url, 'BBC Sport'), 96, 10).map(i => toStory(i, 'sport', team));
  });
  const f = await f1();
  return { generated: new Date().toISOString(), sports, teams, ...(f ? { f1: f } : {}) };
}

/* ---------- AI summaries: new stories only, cached by URL ---------- */

type Cache = Record<string, { summary?: Summary; failed?: boolean; at: string }>;

async function summaries(groups: Story[][]): Promise<StatusFile['summaries']> {
  const cache: Cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, 'utf8')) : {};
  const stats = { made: 0, cached: 0, failed: 0 } as StatusFile['summaries'];
  const all = groups.flat();
  // Attach what we already have
  for (const s of all) { const c = cache[s.url]; if (c?.summary) { s.summary = c.summary; stats.cached++; } }

  const key = process.env.GEMINI_API_KEY;
  if (key) {
    const model = await pickModel(key);
    stats.model = model;
    console.log(`Summaries with ${model}`);
    const todo = groups.flatMap((g, gi) => g.map((s, i) => ({ s, rank: gi * 1000 + i }))).filter(x => !cache[x.s.url]).sort((a, b) => a.rank - b.rank).slice(0, MAX_SUMMARIES);
    for (const { s } of todo) {
      const body = guardianBody.get(s.url);
      const text = body ? htmlToText(body) : await extractText(s.url);
      if (!text) { cache[s.url] = { failed: true, at: new Date().toISOString() }; stats.failed++; continue; }
      const sum = await summarise(key, model, s.title, text);
      if (sum) { s.summary = sum; cache[s.url] = { summary: sum, at: new Date().toISOString() }; stats.made++; }
      else { cache[s.url] = { failed: true, at: new Date().toISOString() }; stats.failed++; }
    }
    // Share summaries between copies of the same story in different files
    for (const s of all) if (!s.summary && cache[s.url]?.summary) s.summary = cache[s.url].summary;
  } else {
    console.log('GEMINI_API_KEY not set: skipping AI summaries (cards show the standfirst)');
  }
  // Forget entries older than 10 days
  const cutoff = Date.now() - 10 * 86400_000;
  for (const [u, c] of Object.entries(cache)) if (+new Date(c.at) < cutoff) delete cache[u];
  await mkdir('pipeline/cache', { recursive: true });
  await writeFile(CACHE, JSON.stringify(cache, null, 1) + '\n');
  return stats;
}

/* ---------- Output ---------- */

const strip = (o: any) => JSON.stringify({ ...o, generated: undefined });
async function writeIfChanged(name: string, data: any) {
  const path = `${OUT}/${name}`;
  if (existsSync(path)) {
    const old = JSON.parse(await readFile(path, 'utf8'));
    if (strip(old) === strip(data)) { console.log(`unchanged ${name}`); return; }
  }
  await writeFile(path, JSON.stringify(data) + '\n');
  console.log(`wrote ${name}`);
}

async function learn(): Promise<LearnFile> {
  const now = new Date();
  const date = todayUTC(now);
  const topics = JSON.parse(await readFile('content/topics.json', 'utf8'));
  const topicsHash = hash(JSON.stringify(topics));
  const path = `${OUT}/learn.json`;
  const old: LearnFile | null = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : null;
  const hub = await hubspot();
  // Wikipedia, NASA and Wikidata: once a day (or when the topic lists change)
  if (old && old.date === date && old.topicsHash === topicsHash && old.cards.length) {
    console.log('Learning content already fresh for today');
    return { ...old, generated: now.toISOString(), hubspot: hub.length ? hub : old.hubspot };
  }
  const daily = await wikipediaDaily(now);
  const [topicList, pic, wd] = [await topicCards(topics, now), await apod(), await wikidataQuizzes(now)];
  const cards = [...daily.cards, ...(pic ? [pic] : []), ...topicList];
  return { generated: now.toISOString(), date, topicsHash, cards, quizzes: [...daily.quizzes, ...wd], hubspot: hub.length ? hub : old?.hubspot || [] };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const [stories, cities, sp, lf] = [await news(), await local(), await sport(), await learn()];

  const priorityLocal = cities[PRIORITY_CITY] || [];
  const otherLocal = Object.entries(cities).filter(([c]) => c !== PRIORITY_CITY).flatMap(([, xs]) => xs.slice(0, 3));
  const topNews = [...stories].sort((a, b) => b.also.length - a.also.length);
  const sum = await summaries([topNews, priorityLocal, Object.values(sp.teams).flat(), Object.values(sp.sports).flat(), otherLocal]);

  const now = new Date().toISOString();
  await writeIfChanged('news.json', { generated: now, stories } satisfies NewsFile);
  await writeIfChanged('local.json', { generated: now, cities } satisfies LocalFile);
  await writeIfChanged('sport.json', { ...sp, generated: now } satisfies SportFile);
  await writeIfChanged('learn.json', lf);
  await writeIfChanged('status.json', { generated: now, sources: status, summaries: sum } satisfies StatusFile);

  const failed = status.filter(s => !s.ok);
  console.log(`\n${status.length - failed.length}/${status.length} sources OK, summaries: ${JSON.stringify(sum)}`);
  if (failed.length) console.log('Failed:\n' + failed.map(f => `  ${f.name}: ${f.error || ''} ${f.url}`).join('\n'));
}

main().catch(e => { console.error(e); process.exit(1); });
