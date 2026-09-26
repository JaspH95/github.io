import type { TopicKey, Story, LearnCard, Quiz, HubItem, Phrase, NewsFile, LocalFile, SportFile, LearnFile, F1Data } from './types';
import { TOPICS, PICKABLE, SCENE, LANG_CODES } from './content';
import { S, w, isLater, today } from './state';
import { tokens, similar } from './similar';
import { phraseOfDay, reviewsDue, hasPack } from './phrases';

export interface Match {
  id: number; kickoff: string; status: string; statusLong: string; elapsed: number | null; league?: string; round?: string;
  home: { id: number; name: string }; away: { id: number; name: string }; score: { home: number | null; away: number | null };
  events: { min?: number; extra?: number; team?: string; player?: string; type?: string; detail?: string }[];
}

export type CardType = 'intro' | 'end' | 'news' | 'learn' | 'quiz' | 'hubspot' | 'phrase' | 'review' | 'signday' | 'live' | 'result' | 'discover' | 'f1';

export interface Card {
  id: string;
  type: CardType;
  t: TopicKey;
  tag?: string;
  image?: string;
  story?: Story;
  learn?: LearnCard;
  quiz?: Quiz;
  hub?: HubItem;
  phrase?: { lang: string; p: Phrase };
  match?: Match;
  team?: string;
  f1?: F1Data;
  discover?: TopicKey;
  pool?: Card[];
  isLater?: boolean;
  isUpdate?: boolean;
  followId?: string;
  reason?: string;
  n?: number;
}

export interface Data { news?: NewsFile; local?: LocalFile; sport?: SportFile; learn?: LearnFile }

export async function loadData(): Promise<Data> {
  const get = async <T>(name: string): Promise<T | undefined> => {
    try { const r = await fetch(`/data/${name}.json`, { cache: 'no-cache' }); return r.ok ? await r.json() : undefined; } catch { return undefined; }
  };
  const [news, local, sport, learn] = await Promise.all([get<NewsFile>('news'), get<LocalFile>('local'), get<SportFile>('sport'), get<LearnFile>('learn')]);
  return { news, local, sport, learn };
}

/* ---------- Turning data into cards ---------- */

export const newsCard = (s: Story): Card => ({ id: s.id, type: 'news', t: s.topic, tag: s.tag, image: s.image, story: s });
const learnCard = (l: LearnCard): Card => ({ id: l.id, type: 'learn', t: l.topic, image: l.image, learn: l });
const quizCard = (q: Quiz): Card => ({ id: q.id, type: 'quiz', t: q.topic, quiz: q });
const hubCard = (h: HubItem): Card => ({ id: h.id, type: 'hubspot', t: 'hubspot', image: h.image, hub: h, tag: h.kind === 'changelog' ? 'New in HubSpot: try it' : undefined });

export const sceneFor = (c: Card) => SCENE[c.t] || 'spark';

const ageHours = (iso: string) => (Date.now() - +new Date(iso)) / 3600000;
const newsScore = (s: Story) => 1 + s.also.length * 0.6 + Math.max(0, 1 - ageHours(s.published) / 24);

/* Topics currently in the feed: picked or accepted, and not hidden */
export function activeTopics(): Set<TopicKey> {
  const on = new Set<TopicKey>();
  (Object.keys(TOPICS) as TopicKey[]).forEach(t => { if ((S.weights[t] || 0) > 0 || S.accepted.has(t)) on.add(t); });
  S.declined.forEach(t => on.delete(t));
  return on;
}

const teamMatch = (team: string) => new RegExp(`\\b${team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

function sportStories(d: Data): Story[] {
  const p = S.profile; if (!p || !d.sport) return [];
  const out: Story[] = [];
  for (const team of p.teams || []) {
    const own = d.sport.teams[team];
    const list = own?.length ? own : (d.sport.sports.Football || []).filter(s => teamMatch(team).test(s.title + ' ' + s.standfirst));
    out.push(...list.slice(0, 4).map(s => ({ ...s, tag: team })));
  }
  for (const sp of p.sports || []) out.push(...(d.sport.sports[sp] || []).slice(0, sp === 'Football' && p.teams?.length ? 3 : 4));
  return out;
}

function f1Card(d: Data): Card | null {
  const f = d.sport?.f1; if (!f || !S.profile?.sports?.includes('Formula 1')) return null;
  const recent = f.last && ageHours(f.last.date + 'T18:00:00Z') < 4 * 24;
  const soon = f.next && ageHours(f.next.date + 'T12:00:00Z') > -6 * 24;
  if (!recent && !soon) return null;
  return { id: `f1-${recent ? 'r' + f.last!.round : 'n' + f.next!.round}`, type: 'f1', t: 'sport', tag: 'Formula 1', f1: f };
}

/* All cards a topic could contribute, used for the main pool and for Discover */
function topicPool(d: Data, t: TopicKey): Card[] {
  const out: Card[] = [];
  const news = (d.news?.stories || []).filter(s => s.topic === t).sort((a, b) => newsScore(b) - newsScore(a)).slice(0, 8);
  out.push(...news.map(newsCard));
  const learn = (d.learn?.cards || []).filter(l => l.topic === t);
  out.push(...learn.map(learnCard));
  if (t === 'general') out.push(...(d.learn?.quizzes || []).map(quizCard));
  if (t === 'hubspot') {
    const hs = d.learn?.hubspot || [];
    out.push(...hs.filter(h => h.kind === 'changelog').slice(0, 4).map(hubCard), ...hs.filter(h => h.kind === 'blog').slice(0, 3).map(hubCard));
  }
  return out;
}

/* Followed stories: an update card appears only when a genuinely new article turns up */
function updates(d: Data): Card[] {
  const all = [...(d.news?.stories || []), ...Object.values(d.local?.cities || {}).flat(), ...Object.values(d.sport?.sports || {}).flat()];
  const out: Card[] = [];
  for (const f of S.followed) {
    const ft = tokens(f.title);
    const hit = all.find(s => similar(ft, tokens(s.title)) && [s.url, ...s.also.map(a => a.url)].some(u => !f.seen.includes(u)));
    if (hit && !out.some(c => c.story?.id === hit.id)) out.push({ ...newsCard(hit), id: `upd-${hit.id}`, isUpdate: true, followId: f.id });
  }
  return out;
}

export function langCards(): Card[] {
  const out: Card[] = [];
  for (const L of S.profile?.langs || []) {
    if (L === 'British Sign Language') { out.push({ id: 'sign-vowels', type: 'signday', t: 'sign', tag: 'BSL' }); continue; }
    if (!LANG_CODES[L] || !hasPack(L)) continue;
    const p = phraseOfDay(L);
    if (p) out.push({ id: `phrase-${p.id}`, type: 'phrase', t: 'lang', tag: L, phrase: { lang: L, p } });
  }
  return out;
}
function reviewCards(): Card[] {
  return (S.profile?.langs || []).filter(hasPack).flatMap(L => reviewsDue(L).map(p => ({ id: `review-${p.id}-${today()}`, type: 'review' as const, t: 'lang' as TopicKey, tag: L, phrase: { lang: L, p } })));
}

export function discoverCard(d: Data, t: TopicKey): Card {
  return { id: `discover-${t}`, type: 'discover', t, discover: t, pool: topicPool(d, t).slice(0, 5) };
}

/* Fresh feed on every open */
export function buildOrder(d: Data, extraTop: Card[] = []): Card[] {
  const active = activeTopics();
  const saved = S.later.map(c => ({ ...c, isLater: true }));
  const langNow = langCards().filter(c => !isLater(c.id));
  const ups = updates(d).filter(c => !isLater(c.id));

  let pool: Card[] = [];
  active.forEach(t => { if (t !== 'local' && t !== 'sport' && t !== 'lang' && t !== 'sign') pool.push(...topicPool(d, t)); });
  if (active.has('sign')) pool.push(...topicPool(d, 'sign'));
  const place = S.profile?.place;
  if (place && active.has('local')) pool.push(...(d.local?.cities[place] || []).sort((a, b) => newsScore(b) - newsScore(a)).slice(0, 8).map(newsCard));
  if (active.has('sport')) { pool.push(...sportStories(d).map(newsCard)); const f = f1Card(d); if (f) pool.push(f); }
  pool.push(...reviewCards());

  // One card per story, nothing already pinned to the top
  const topIds = new Set([...saved, ...langNow, ...ups, ...extraTop].map(c => c.id));
  const upStories = new Set(ups.map(c => c.story!.id));
  const seenIds = new Set<string>();
  pool = pool.filter(c => !topIds.has(c.id) && !upStories.has(c.id) && !seenIds.has(c.id) && (seenIds.add(c.id), true));

  // Weighted shuffle: interest in the topic, how big the story is, and whether you've already seen it
  const t0 = today();
  const k = new Map<Card, number>();
  pool.forEach(c => {
    let weight = w(c.t) * (c.story ? newsScore(c.story) : 1);
    if (S.seen[c.id] && S.seen[c.id] < t0) weight *= 0.25;
    if (S.liked.has(c.id)) weight *= 0.5;
    k.set(c, Math.pow(Math.random(), 1 / weight));
  });
  pool.sort((a, b) => k.get(b)! - k.get(a)!);
  const len = Math.max(24, Math.min(80, Math.round((S.profile?.mins || 15) * 2.5)));
  pool = pool.slice(0, len);

  // Never the same topic twice in a row
  const out: Card[] = [];
  while (pool.length) { let i = pool.findIndex(c => !out.length || c.t !== out[out.length - 1].t); if (i < 0) i = 0; out.push(pool.splice(i, 1)[0]); }

  // Discover: suggest topics you haven't picked, around positions 6 and 13
  const candidates = PICKABLE.filter(t => !active.has(t) && !S.declined.has(t) && topicPool(d, t).length);
  candidates.sort(() => Math.random() - 0.5).slice(0, 2).forEach((t, i) => out.splice(Math.min(out.length, 5 + i * 7), 0, discoverCard(d, t)));

  return [{ id: 'intro', type: 'intro', t: 'general', n: saved.length }, ...extraTop, ...langNow, ...ups, ...saved, ...out, { id: 'end', type: 'end', t: 'general' }];
}
