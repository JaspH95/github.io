/* The latest data, written hourly by the pipeline to /data. Cached by the service worker for offline use. */
import type { NewsFile, LocalFile, SportFile, LearnFile, StatusFile, Story, InterestsFile, Interest, TopicKey, LearnCard } from './types';
import interestsJson from '../content/interests.json';
import { BBC_REGIONS, WORLD_CITIES, TEAM_SLUGS, SPORT_FEEDS } from '../pipeline/sources';
import { S, load, save, today, type Place } from './state';
import { OUTLETS, type NewsItem, type Region, type Outlet } from '../api/news';
export { OUTLETS, type Outlet };

export const INTERESTS = (interestsJson as unknown as InterestsFile).interests;
export const CATEGORIES = (interestsJson as unknown as InterestsFile).categories;
export const interestById = new Map<string, Interest>(INTERESTS.map(i => [i.id, i]));
export { BBC_REGIONS, WORLD_CITIES, TEAM_SLUGS, SPORT_FEEDS };

export interface Live { breaking: Story[]; outlets: Record<string, Story[]>; topics: Record<string, Story[]>; learn: LearnCard[]; at: number }
export interface Data { news?: NewsFile; local?: LocalFile; sport?: SportFile; learn?: LearnFile; status?: StatusFile; extraLocal?: Story[]; live?: Live; loadedAt: number }
export let data: Data = { loadedAt: 0 };

async function get<T>(name: string): Promise<T | undefined> {
  try { const r = await fetch(`/data/${name}.json`, { cache: 'no-cache' }); return r.ok ? await r.json() : undefined; } catch { return undefined; }
}

export async function loadData(): Promise<Data> {
  const [news, local, sport, learn, status] = await Promise.all([get<NewsFile>('news'), get<LocalFile>('local'), get<SportFile>('sport'), get<LearnFile>('learn'), get<StatusFile>('status')]);
  data = { news, local, sport, learn, status, live: await liveNews(), loadedAt: Date.now() };
  // Cities the pipeline doesn't cover: the Guardian, via our own function
  const c = S.profile?.city;
  if (c && !c.region && !c.world) {
    try { const r = await fetch(`/api/local?city=${encodeURIComponent(c.name)}`); if (r.ok) data.extraLocal = (await r.json()).stories || []; } catch { /* offline */ }
  }
  return data;
}

/* ---------- Live news: breaking headlines, outlets you follow, topics you typed in ---------- */

export function regionOf(country?: string): Region {
  if (!country || ['GB', 'IM', 'JE', 'GG'].includes(country)) return 'uk';
  if (country === 'US') return 'us';
  if (country === 'IE') return 'ie';
  if (country === 'AU') return 'au';
  return 'world';
}
const KIND_TOPIC: Record<Outlet['kind'], TopicKey> = { news: 'news', tech: 'tech', business: 'money', science: 'science', sport: 'sport', culture: 'culture' };

/* A live headline as a story the feed and story page understand. Only the outlet's own headline, summary and picture */
export function itemStory(x: NewsItem, via: string, topic?: TopicKey, tags: string[] = []): Story {
  const o = OUTLETS.find(y => y.id === x.outletId);
  return {
    id: `live-${x.id}`, title: x.title, standfirst: x.summary, url: x.url, outlet: x.outlet, published: x.published, first: x.published, updated: x.published,
    topic: topic || (o ? KIND_TOPIC[o.kind] : 'news'), tags, importance: 0, via,
    articles: [{ outlet: x.outlet, url: x.url, title: x.title, published: x.published, ...(x.image ? { image: x.image } : {}) }] as Story['articles'],
    ...(x.image ? { image: { url: x.image, source: 'article' as const, credit: x.outlet, link: x.url } } : {}),
    ...(x.paywall ? { paywall: true } : {}),
  };
}

async function api<T>(url: string, ms = 4500): Promise<T | null> {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(ms) }); return r.ok ? await r.json() as T : null; } catch { return null; }
}

/* Related Wikipedia articles for a learning topic someone typed in (Wikipedia allows this from the browser) */
async function wikiRelated(title: string, interest: string, topic: TopicKey): Promise<LearnCard[]> {
  const q = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&generator=search&gsrnamespace=0&gsrlimit=8&gsrsearch=${encodeURIComponent(`morelike:${title}`)}&prop=extracts|pageimages|info|description&exintro=1&explaintext=1&exsentences=4&piprop=thumbnail&pithumbsize=960&inprop=url`;
  const r = await api<any>(q, 6000);
  const pages: any[] = (r?.query?.pages || []).filter((p: any) => p.extract && p.extract.length > 280 && !/^(List|Outline|Index) of/.test(p.title));
  return pages.map(p => ({ id: `q-${interest}-${p.pageid}`, kind: 'topic', topic, interest, title: p.title, ...(p.description ? { description: p.description } : {}), extract: p.extract.slice(0, 900), ...(p.thumbnail ? { image: p.thumbnail.source } : {}), url: p.fullurl, source: 'Wikipedia' } as LearnCard));
}

async function liveNews(): Promise<Live | undefined> {
  const p = S.profile; if (!p) return undefined;
  const cached = load<Live | null>('live', null);
  const region = regionOf(p.city?.country);
  const outlets = (p.outlets || []).filter(id => OUTLETS.some(o => o.id === id));
  const newsTopics = p.interests.filter(i => i.id.startsWith('q:') && i.mode !== 'learn');
  const learnTopics = p.interests.filter(i => i.id.startsWith('q:') && i.mode !== 'news' && i.wiki);
  const [b, os, ts] = await Promise.all([
    p.breaking === false ? Promise.resolve(null) : api<{ items: NewsItem[] }>(`/api/news?mode=breaking&region=${region}`),
    Promise.all(outlets.map(id => api<{ items: NewsItem[] }>(`/api/news?mode=outlet&id=${id}`))),
    Promise.all(newsTopics.map(i => api<{ items: NewsItem[] }>(`/api/news?mode=search&region=${region}&days=3&q=${encodeURIComponent(i.label)}`))),
  ]);
  // Learning for typed-in topics changes slowly: once a day is plenty
  const ql = load<{ date: string; cards: LearnCard[] } | null>('qlearn', null);
  let learn = ql?.date === today() ? ql.cards : [];
  if (!learn.length && learnTopics.length) {
    learn = (await Promise.all(learnTopics.map(i => wikiRelated(i.wiki!, i.id, i.cat)))).flat();
    if (learn.length) save('qlearn', { date: today(), cards: learn });
  }
  const live: Live = {
    breaking: b?.items?.length ? b.items.map(x => itemStory(x, x.outlets && x.outlets.length > 1 ? 'Breaking' : 'Top story')) : p.breaking === false ? [] : cached?.breaking || [],
    outlets: Object.fromEntries(outlets.map((id, k) => [id, os[k]?.items?.length ? os[k]!.items.map(x => itemStory(x, x.outlet)) : cached?.outlets?.[id] || []])),
    topics: Object.fromEntries(newsTopics.map((i, k) => [i.id, ts[k]?.items?.length ? ts[k]!.items.map(x => itemStory(x, i.label, i.cat === 'sport' ? 'sport' : i.cat, [i.id])) : cached?.topics?.[i.id] || []])),
    learn, at: Date.now(),
  };
  save('live', live);
  return live;
}

/* ---------- Places ---------- */

const rad = (d: number) => (d * Math.PI) / 180;
export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/* The nearest BBC local region (UK and Ireland's border areas), or a covered world city, or neither */
export function placeFor(name: string, country: string, lat: number, lon: number): Place {
  const p: Place = { name, country, lat, lon };
  if (country === 'GB' || country === 'IM' || country === 'JE' || country === 'GG') {
    const best = [...BBC_REGIONS].sort((a, b) => km(p, a) - km(p, b))[0];
    if (best) p.region = best.id;
    return p;
  }
  const w = [...WORLD_CITIES].sort((a, b) => km(p, a) - km(p, b))[0];
  if (w && km(p, w) < 120) p.world = w.id;
  return p;
}

export const regionName = (p?: Place) => p?.region ? BBC_REGIONS.find(r => r.id === p.region)?.name : p?.world ? WORLD_CITIES.find(r => r.id === p.world)?.name : p?.name;

export function localStories(): Story[] {
  const p = S.profile?.city;
  if (!p) return [];
  if (p.region) return data.local?.regions?.[p.region] || [];
  if (p.world) return data.local?.regions?.[p.world] || [];
  return data.extraLocal || [];
}

/* Every story the app knows about, for looking one up by id */
export function allStories(): Story[] {
  const out: Story[] = [...(data.news?.stories || []), ...localStories()];
  const l = data.live;
  if (l) out.push(...l.breaking, ...Object.values(l.outlets).flat(), ...Object.values(l.topics).flat());
  for (const xs of Object.values(data.sport?.teams || {})) out.push(...xs);
  for (const xs of Object.values(data.sport?.sports || {})) out.push(...xs);
  return out;
}
export const findStory = (id: string) => allStories().find(s => s.id === id);

/* ---------- Topics ---------- */

export const TOPIC_LABEL: Record<TopicKey, string> = {
  news: 'News', tech: 'Tech', science: 'Science', money: 'Money & work', culture: 'Culture', life: 'Life', sport: 'Sport',
  local: 'Local', general: 'Worth knowing', space: 'Space', lang: 'Languages', sign: 'Sign language', work: 'Your work',
};

/* The friendliest label for a story: its first matching interest, or its topic */
export function storyLabel(s: Story): string {
  if (s.via && s.via !== 'Breaking' && s.via !== 'Top story') return s.via;
  if (s.topic === 'local' && s.tag) return s.tag;
  if (s.topic === 'sport' && s.tag) return s.tag;
  const mine = new Set(S.profile?.interests.map(i => i.id) || []);
  const t = s.tags.find(t => mine.has(t)) || s.tags[0];
  return (t && interestById.get(t)?.label) || TOPIC_LABEL[s.topic] || 'News';
}
