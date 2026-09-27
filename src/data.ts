/* The latest data, written hourly by the pipeline to /data. Cached by the service worker for offline use. */
import type { NewsFile, LocalFile, SportFile, LearnFile, StatusFile, Story, InterestsFile, Interest, TopicKey } from './types';
import interestsJson from '../content/interests.json';
import { BBC_REGIONS, WORLD_CITIES, TEAM_SLUGS, SPORT_FEEDS } from '../pipeline/sources';
import { S, type Place } from './state';

export const INTERESTS = (interestsJson as unknown as InterestsFile).interests;
export const CATEGORIES = (interestsJson as unknown as InterestsFile).categories;
export const interestById = new Map<string, Interest>(INTERESTS.map(i => [i.id, i]));
export { BBC_REGIONS, WORLD_CITIES, TEAM_SLUGS, SPORT_FEEDS };

export interface Data { news?: NewsFile; local?: LocalFile; sport?: SportFile; learn?: LearnFile; status?: StatusFile; extraLocal?: Story[]; loadedAt: number }
export let data: Data = { loadedAt: 0 };

async function get<T>(name: string): Promise<T | undefined> {
  try { const r = await fetch(`/data/${name}.json`, { cache: 'no-cache' }); return r.ok ? await r.json() : undefined; } catch { return undefined; }
}

export async function loadData(): Promise<Data> {
  const [news, local, sport, learn, status] = await Promise.all([get<NewsFile>('news'), get<LocalFile>('local'), get<SportFile>('sport'), get<LearnFile>('learn'), get<StatusFile>('status')]);
  data = { news, local, sport, learn, status, loadedAt: Date.now() };
  // Cities the pipeline doesn't cover: the Guardian, via our own function
  const c = S.profile?.city;
  if (c && !c.region && !c.world) {
    try { const r = await fetch(`/api/local?city=${encodeURIComponent(c.name)}`); if (r.ok) data.extraLocal = (await r.json()).stories || []; } catch { /* offline */ }
  }
  return data;
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
  if (s.topic === 'local' && s.tag) return s.tag;
  if (s.topic === 'sport' && s.tag) return s.tag;
  const mine = new Set(S.profile?.interests.map(i => i.id) || []);
  const t = s.tags.find(t => mine.has(t)) || s.tags[0];
  return (t && interestById.get(t)?.label) || TOPIC_LABEL[s.topic] || 'News';
}
