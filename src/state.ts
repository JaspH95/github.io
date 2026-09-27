/* Everything personal lives in this browser's storage. If you sign in, cloud.ts copies it to your
   Knowfeed account so it survives a new phone or adding the app to the Home Screen. */
import type { TopicKey, Story, LearnCard, Quiz, HubItem } from './types';

const P = 'kf2-';
export const load = <T>(k: string, d: T): T => { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : d; } catch { return d; } };
let changed: (k: string) => void = () => {};
export const onChange = (fn: (k: string) => void) => { changed = fn; };
export const save = (k: string, v: unknown) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* storage full or blocked */ } changed(k); };
export const remove = (k: string) => { try { localStorage.removeItem(P + k); } catch { /* blocked */ } changed(k); };
export const allKeys = () => { try { return Object.keys(localStorage).filter(k => k.startsWith(P)).map(k => k.slice(P.length)); } catch { return []; } };

export type Slot = 'morning' | 'midday' | 'evening';
export type Mode = 'news' | 'learn' | 'both';

export interface PickedInterest {
  id: string;                 // starter id, or "q:<label>" for one found by search
  label: string;
  cat: TopicKey;
  mode: Mode;
  guardian?: string;          // Guardian keyword tag for searched interests
  wiki?: string;              // Wikipedia title for searched interests
}
export interface Language { name: string; level: 'new' | 'basics' | 'getting-by' | 'confident'; goal: 'travel' | 'family' | 'work' | 'fun' }
export interface Place { name: string; country: string; lat: number; lon: number; region?: string; world?: string }
export interface Job { uri?: string; title: string; raw: string; group?: string; areas?: string[] }
export interface SkillPick { id: string; label: string; source: 'job' | 'chosen' }

export interface Profile {
  name: string;
  city?: Place;
  job?: Job;
  skills: SkillPick[];
  interests: PickedInterest[];
  languages: Language[];
  sports: string[];
  teams: string[];
  outlets?: string[];         // news outlets followed (ids from api/news.ts)
  breaking?: boolean;         // breaking headlines; on unless turned off
  avoid: string[];            // interest ids
  editions: Record<Slot, { on: boolean; time: string }>;
  quiet: { on: boolean; weekdays: [string, string][] };
  goalMin?: number;
  limitMin?: number;
  created: string;
}

export const DEFAULT_EDITIONS: Profile['editions'] = { morning: { on: true, time: '07:00' }, midday: { on: true, time: '12:30' }, evening: { on: true, time: '18:00' } };
export const DEFAULT_QUIET: Profile['quiet'] = { on: true, weekdays: [['09:00', '12:00'], ['13:30', '17:30']] };

/* A card kept whole when saved, since the live data moves on */
/* Phrases and skills are kept as references, so Saved always shows their latest version and your progress */
export interface SavedItem { id: string; kind: 'story' | 'learn' | 'quiz' | 'hub' | 'skill' | 'phrase'; title: string; topic: TopicKey; at: string; story?: Story; learn?: LearnCard; quiz?: Quiz; hub?: HubItem; skill?: { id: string; label: string }; phrase?: { lang: string; id: string } }
export interface FollowedStory { id: string; title: string; urls: string[]; names: string[]; at: string; seenCount: number }
export interface DayStats { read: number; learned: number; quizRight: number; quizDone: number; secs: number; opened: number; finished: number }
export interface Feedback { at: string; item?: string; title?: string; text: string }
/* Stories you've already had: seen in a feed, opened, marked as read, or said no to. Kept with the headline,
   so the same news from another outlet (a different id) is recognised and left out too. */
export type GoneWhy = 'seen' | 'read' | 'done' | 'know' | 'hide';
export interface Gone { t: string; d: string; k: GoneWhy; u?: string; l?: 1 }   // l: a learning card, not a story

export const S = {
  profile: load<Profile | null>('profile', null),
  liked: new Set<string>(load<string[]>('liked', [])),
  saved: load<SavedItem[]>('saved', []),
  follows: load<FollowedStory[]>('follows', []),
  entities: new Set<string>(load<string[]>('entities', [])),     // followed people, places and things (lower case)
  weights: load<Record<string, number>>('weights', {}),           // interest ids and topic keys, nudged by likes and "fewer like this"
  seen: load<Record<string, string>>('seen', {}),                 // card id -> date last seen
  read: load<Record<string, string>>('read', {}),                 // story ids opened -> date
  stats: load<Record<string, DayStats>>('stats', {}),
  feedback: load<Feedback[]>('feedback', []),
  history: load<Record<string, Gone>>('history', {}),
  depth: load<Record<string, number>>('depth', {}),                // interest id -> how many times you've said "I know this"
};

export const persist = {
  profile: () => save('profile', S.profile),
  liked: () => save('liked', [...S.liked]),
  saved: () => save('saved', S.saved),
  follows: () => save('follows', S.follows),
  entities: () => save('entities', [...S.entities]),
  weights: () => save('weights', S.weights),
  seen: () => save('seen', S.seen),
  read: () => save('read', S.read),
  stats: () => save('stats', S.stats),
  feedback: () => save('feedback', S.feedback),
  history: () => save('history', S.history),
  depth: () => save('depth', S.depth),
};

/* ---------- Time (the dev menu can fake it) ---------- */
let offset = load<number>('dev-offset', 0);
export const now = () => new Date(Date.now() + offset);
export const setFakeTime = (d: Date | null) => { offset = d ? +d - Date.now() : 0; save('dev-offset', offset); };
export const faking = () => offset !== 0;

export const ymd = (d = now()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(now());
export const addDays = (date: string, n: number) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };

export function day(date = today()): DayStats {
  return (S.stats[date] ||= { read: 0, learned: 0, quizRight: 0, quizDone: 0, secs: 0, opened: 0, finished: 0 });
}
export function bump(k: keyof DayStats, n = 1) { day()[k] += n; persist.stats(); }

export function markSeen(id: string) {
  if (S.seen[id]) return false;
  S.seen[id] = today();
  const cutoff = addDays(today(), -10);
  for (const [k, d] of Object.entries(S.seen)) if (d < cutoff) delete S.seen[k];
  persist.seen();
  return true;
}
export function markRead(id: string) {
  const first = !S.read[id];
  S.read[id] = today();
  const cutoff = addDays(today(), -10);
  for (const [k, d] of Object.entries(S.read)) if (d < cutoff) delete S.read[k];
  persist.read();
  return first;
}

/* Remember a story as had. A stronger reason replaces a weaker one; seen stories are kept 7 days, the rest 21. */
const RANK: Record<GoneWhy, number> = { seen: 0, read: 1, done: 2, know: 3, hide: 3 };
export function remember(s: { id: string; title: string; url?: string }, k: GoneWhy, learning = false) {
  const had = S.history[s.id];
  if (had && RANK[had.k] >= RANK[k] && had.d === today()) return;
  S.history[s.id] = { t: s.title, d: today(), k: had && RANK[had.k] > RANK[k] ? had.k : k, ...(s.url ? { u: s.url } : {}), ...(learning ? { l: 1 as const } : {}) };
  const seenCut = addDays(today(), -7), cut = addDays(today(), -21);
  for (const [id, g] of Object.entries(S.history)) if (g.d < (g.k === 'seen' ? seenCut : cut)) delete S.history[id];
  const ids = Object.keys(S.history);
  if (ids.length > 900) ids.sort((a, b) => S.history[a].d.localeCompare(S.history[b].d)).slice(0, ids.length - 900).forEach(id => delete S.history[id]);
  persist.history();
}
/* Said no to, or marked as read: these never show again, even in an edition you've already opened */
export const dismissed = (id: string) => ['done', 'know', 'hide'].includes(S.history[id]?.k || '');

/* Learning about a topic skips articles most people already know (by Wikipedia views a day).
   Each "I know this" halves the limit for that interest, so it goes deeper. */
export const knownLimit = (interest?: string) => Math.max(150, 2500 / 2 ** (interest ? S.depth[interest] || 0 : 0));
export const tooKnown = (c: { pop?: number; interest?: string }) => (c.pop ?? 0) > knownLimit(c.interest);

export const isSaved = (id: string) => S.saved.some(x => x.id === id);
export const isFollowing = (id: string) => S.follows.some(f => f.id === id);
export const weight = (k: string) => S.weights[k] || 0;
export function nudge(k: string, by: number) { S.weights[k] = Math.max(-3, Math.min(6, (S.weights[k] || 0) + by)); persist.weights(); }
