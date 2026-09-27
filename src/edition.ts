/* Editions: Morning, Midday and Evening. Each is a finite set, built on the phone from the latest data
   and kept for that slot so it doesn't reshuffle while you read. If you've missed earlier editions today,
   they're merged into one catch-up ("While you were away"). Anything below the cut goes to "Earlier today". */
import { S, load, save, now, ymd, addDays, weight, type Slot, type Profile } from './state';
import { data, localStories, interestById, storyLabel, TOPIC_LABEL } from './data';
import { tokens, similar } from './similar';
import { matcher, matches } from './match';
import * as srs from './srs';
import { phraseOfDay, hasPack, PACKS } from './languages';
import type { Story, LearnCard } from './types';
import type { Card } from './cards';

export const SLOTS: Slot[] = ['morning', 'midday', 'evening'];
export const SLOT_LABEL: Record<Slot, string> = { morning: 'Morning edition', midday: 'Midday edition', evening: 'Evening edition' };

export interface Edition {
  key: string;
  date: string;
  slot: Slot;
  builtAt: string;
  since: string;
  catchup: boolean;
  merged: Slot[];             // earlier slots folded into this one
  cards: Card[];
  earlier: Card[];            // below the cut
  finishedAt?: string;
}

/* ---------- Slots ---------- */

const at = (date: string, time: string) => new Date(`${date}T${time}:00`);
function enabled(p: Profile | null): Slot[] {
  const on = SLOTS.filter(s => p?.editions?.[s]?.on !== false);
  return on.length ? on : ['morning'];
}
const timeOf = (p: Profile | null, s: Slot) => p?.editions?.[s]?.time || { morning: '07:00', midday: '12:30', evening: '18:00' }[s];

/* The edition you should be reading now: the latest one whose time has passed (yesterday's last one before the first today) */
export function currentSlot(p = S.profile, d = now()): { slot: Slot; date: string } {
  const date = ymd(d);
  const passed = enabled(p).filter(s => at(date, timeOf(p, s)) <= d);
  if (passed.length) return { slot: passed[passed.length - 1], date };
  const list = enabled(p);
  return { slot: list[list.length - 1], date: addDays(date, -1) };
}

export function nextSlot(p = S.profile, d = now()): { slot: Slot; at: Date } {
  const date = ymd(d);
  for (const s of enabled(p)) { const t = at(date, timeOf(p, s)); if (t > d) return { slot: s, at: t }; }
  const first = enabled(p)[0];
  return { slot: first, at: at(addDays(date, 1), timeOf(p, first)) };
}

export function nextLabel(p = S.profile, d = now()): string {
  const n = nextSlot(p, d);
  const time = n.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const tomorrow = ymd(n.at) !== ymd(d);
  return `${SLOT_LABEL[n.slot].replace(' edition', '')} edition at ${time}${tomorrow ? ' tomorrow' : ''}`;
}

/* ---------- Storage ---------- */

let store = load<Record<string, Edition>>('editions', {});
const persist = () => {
  const keys = Object.keys(store).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 5))) delete store[k];
  save('editions', store);
};
export const editions = () => store;
export function markFinished(e: Edition) { if (!store[e.key]) return; store[e.key].finishedAt ||= now().toISOString(); persist(); }
export function forget(key?: string) { if (key) delete store[key]; else store = {}; persist(); }
export const reloadEditions = () => { store = load('editions', {}); };

/* Everything shown in recent editions, so the next one only has what's new */
function shownIds(): Set<string> {
  const out = new Set<string>();
  for (const e of Object.values(store)) { e.cards.forEach(c => out.add(c.id)); }
  return out;
}

/* ---------- Scoring (weights from PRODUCT.md) ---------- */

interface Ctx {
  newsInterests: Set<string>;
  searched: { label: string; guardian?: string; re: RegExp }[];
  work: RegExp | null;
  follows: typeof S.follows;
  entities: Set<string>;
  teams: Set<string>;
  region?: string;
  city?: string;
  avoid: ReturnType<typeof matcher>[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function context(p: Profile): Ctx {
  const news = p.interests.filter(i => i.mode !== 'learn');
  const workWords = [
    ...(p.job?.title ? [p.job.title] : []),
    ...p.skills.map(s => s.label).filter(l => l.split(' ').length <= 3),
  ].filter(w => w.length > 3);
  return {
    newsInterests: new Set(news.filter(i => !i.id.startsWith('q:')).map(i => i.id)),
    searched: news.filter(i => i.id.startsWith('q:')).map(i => ({ label: i.label, guardian: i.guardian, re: new RegExp(`\\b${escapeRe(i.label)}\\b`, 'i') })),
    work: workWords.length ? new RegExp(`\\b(${workWords.map(escapeRe).join('|')})\\b`, 'i') : null,
    follows: S.follows,
    entities: S.entities,
    teams: new Set(p.teams),
    region: p.city?.region || p.city?.world,
    city: p.city?.name,
    avoid: p.avoid.map(id => interestById.get(id)).filter(Boolean).map(i => matcher(i!)),
  };
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));

export function relevance(s: Story, c: Ctx): number {
  let r = 0;
  for (const t of s.tags) if (c.newsInterests.has(t)) r = Math.max(r, clamp(0.75 + weight(t) * 0.1));
  const text = `${s.title} ${s.standfirst}`;
  for (const q of c.searched) {
    if (q.guardian && s.kw?.includes(q.guardian)) r = Math.max(r, 1);
    else if (q.re.test(text)) r = Math.max(r, 0.8);
  }
  if (c.work?.test(text)) r = Math.max(r, 0.7);
  if (s.entities?.some(e => c.entities.has(e.name.toLowerCase()))) r = Math.max(r, 1);
  if (!c.newsInterests.size && !c.searched.length) r = Math.max(r, 0.4);
  // "Show fewer like this" lowers a whole topic
  r += Math.min(0, weight(s.topic)) * 0.12;
  return clamp(r);
}

export function personal(s: Story, c: Ctx): number {
  if (c.follows.some(f => f.id === s.id || s.articles.some(a => f.urls.includes(a.url)))) return 1;
  if (s.topic === 'local') return 1;
  if (s.topic === 'sport' && s.tag && c.teams.has(s.tag)) return 1;
  if (s.entities?.some(e => c.entities.has(e.name.toLowerCase()))) return 0.8;
  if (c.city && new RegExp(`\\b${escapeRe(c.city)}\\b`).test(s.title)) return 0.6;
  return 0;
}

const freshness = (s: Story, d: Date) => clamp(1 - (+d - +new Date(s.updated)) / (12 * 3600_000));
const avoided = (s: Story, c: Ctx) => c.avoid.some(m => s.tags.includes(m.id) || matches(m, s.title, s.standfirst, s.kw));

/* ---------- Building ---------- */

const storyCard = (s: Story, extra: Partial<Card> = {}): Card => ({ id: s.id, kind: 'story', topic: s.topic, label: storyLabel(s), story: s, ...extra });

function dedupe(list: Story[]): Story[] {
  const out: Story[] = [];
  const urls = new Set<string>();
  for (const s of list) {
    if (s.articles.some(a => urls.has(a.url))) continue;
    const t = tokens(s.title);
    if (out.some(o => similar(tokens(o.title), t))) continue;
    s.articles.forEach(a => urls.add(a.url));
    out.push(s);
  }
  return out;
}

/* The first two news cards (breaking) lead; the rest of the news is spread evenly through the learning, with light
   cards a third and two-thirds of the way in. Then make sure no topic appears twice in a row. */
function weave(news: Card[], learning: Card[], light: Card[]): Card[] {
  const head = news.slice(0, Math.min(2, news.filter(c => c.must || c.followed).length || 1));
  const N = news.slice(head.length), L = [...learning];
  const body: Card[] = [];
  const ratio = N.length / Math.max(1, N.length + L.length);
  let acc = 0;
  while (N.length || L.length) {
    acc += ratio;
    if ((acc >= 1 && N.length) || !L.length) { body.push(N.shift()!); acc -= 1; } else body.push(L.shift()!);
  }
  const F = [...light];
  if (F.length) body.splice(Math.max(1, Math.round(body.length / 3)), 0, F.shift()!);
  if (F.length) body.splice(Math.max(2, Math.round((body.length * 2) / 3)), 0, ...F);
  const out = [...head, ...body];
  for (let i = 1; i < out.length; i++) {
    if (out[i].topic !== out[i - 1].topic || out[i].must) continue;
    const j = out.findIndex((c, k) => k > i && c.topic !== out[i - 1].topic && !c.must);
    if (j > i) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function learningCards(p: Profile, firstToday: boolean, count: number, used: Set<string>): { learning: Card[]; light: Card[] } {
  const learn = data.learn;
  const learning: Card[] = [];
  const light: Card[] = [];
  const fresh = (id: string) => !used.has(id) && !S.seen[id];

  // Phrase of the day for each language, in the first edition of the day
  for (const l of p.languages) {
    if (!hasPack(l.name)) continue;
    const ph = firstToday ? phraseOfDay(l.name, l.goal, l.level) : null;
    if (ph) learning.push({ id: `pod-${l.name}-${ph.id}`, kind: 'phrase', topic: 'lang', label: `${l.name} phrase of the day`, phrase: { lang: l.name, id: ph.id } });
  }
  // BSL: the vowels, once a day
  if (firstToday && p.languages.some(l => l.name === 'British Sign Language')) learning.push({ id: `sign-${ymd(now())}`, kind: 'sign', topic: 'sign', label: 'Sign of the day' });
  // Skill of the day, in the first edition of the day
  if (firstToday && p.skills.length) {
    const k = p.skills[Math.floor(+now() / 86400_000) % p.skills.length];
    learning.push({ id: `skill-${k.id}-${ymd(now())}`, kind: 'skill', topic: 'work', label: 'Skill of the day', skill: { id: k.id, label: k.label } });
  }
  // "Remember this?" reviews: spread through the day (at most 3 per language)
  for (const it of srs.due({ kind: 'phrase', max: firstToday ? 2 : 1, mark: true })) {
    const [, lang, id] = it.key.split(':');
    if (PACKS[lang]?.some(x => x.id === id)) learning.push({ id: `rev-${it.key}-${ymd(now())}`, kind: 'review', topic: 'lang', label: `Remember this? · ${lang}`, phrase: { lang, id }, review: it.key });
  }

  // Learning cards for the interests you want to learn about
  const learnIds = new Set(p.interests.filter(i => i.mode !== 'news').map(i => i.id));
  const avoid = new Set(p.avoid);
  // Includes related Wikipedia articles for topics you typed in yourself
  const topicCards = [...(learn?.cards || []), ...(data.live?.learn || [])].filter(c => c.kind === 'topic' && fresh(c.id) && (c.interest ? learnIds.has(c.interest) && !avoid.has(c.interest) : c.topic === 'sign' && p.languages.some(l => l.name === 'British Sign Language')));
  // Rotate interests so one doesn't take over, favouring the ones you like
  const byInterest = new Map<string, LearnCard[]>();
  for (const c of topicCards) { const k = c.interest || c.topic; byInterest.set(k, [...(byInterest.get(k) || []), c]); }
  const order = [...byInterest.keys()].sort((a, b) => weight(b) - weight(a) || (seedOf(a) % 97) - (seedOf(b) % 97));
  let round = 0;
  while (learning.length < count && round < 4) {
    for (const k of order) { const c = byInterest.get(k)![round]; if (c && learning.length < count) learning.push(learnCard(c)); }
    round++;
  }
  // A data quiz
  const quiz = (learn?.quizzes || []).find(q => fresh(q.id));
  if (quiz) learning.splice(Math.min(3, learning.length), 0, { id: quiz.id, kind: 'quiz', topic: quiz.topic, label: 'Quiz', quiz });
  // Industry updates for marketing, sales and CRM people
  const crm = p.interests.some(i => ['marketing', 'sales'].includes(i.id)) || /crm|hubspot|marketing|sales|revops|customer success/i.test(`${p.job?.title || ''} ${p.job?.raw || ''}`);
  if (crm) {
    const h = (learn?.hubspot || []).filter(h => fresh(h.id)).sort((a, b) => (a.kind === 'changelog' ? 0 : 1) - (b.kind === 'changelog' ? 0 : 1) || +new Date(b.published) - +new Date(a.published))[0];
    if (h) learning.push({ id: h.id, kind: 'hub', topic: 'work', label: h.kind === 'changelog' ? 'New in HubSpot: try it' : 'HubSpot blog', hub: h });
  }

  // Light: one thing worth knowing (on this day, picture of the day, NASA, most read)
  const lightPool = (learn?.cards || []).filter(c => c.kind !== 'topic' && fresh(c.id))
    .filter(c => c.kind !== 'apod' || learnIds.has('space') || learnIds.size === 0 || p.interests.some(i => i.cat === 'science'));
  const pickLight = lightPool.find(c => c.kind === (firstToday ? 'onthisday' : 'mostread')) || lightPool[0];
  if (pickLight) light.push(learnCard(pickLight));
  const apodCard = lightPool.find(c => c.kind === 'apod' && c !== pickLight);
  if (apodCard && firstToday) light.push(learnCard(apodCard));
  return { learning, light };
}

const seedOf = (s: string) => [...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) + Math.floor(+now() / 86400_000);

export function learnCard(c: LearnCard): Card {
  const label = c.kind === 'onthisday' ? 'On this day' : c.kind === 'potd' ? 'Picture of the day' : c.kind === 'apod' ? 'NASA picture of the day'
    : c.kind === 'featured' ? "Wikipedia's featured article" : c.kind === 'mostread' ? 'Most read today'
    : (c.interest && interestById.get(c.interest)?.label) || TOPIC_LABEL[c.topic];
  return { id: c.id, kind: 'learn', topic: c.kind === 'apod' ? 'space' : c.topic, label, learn: c };
}

/* Sport stories go in the feed like any other story: a story from each of your teams, then each of your sports */
function sportStories(p: Profile, since: Date, shown: Set<string>, max: number): Story[] {
  const sp = data.sport; if (!sp) return [];
  const groups = [...p.teams.map(t => (sp.teams?.[t]?.length ? sp.teams[t] : footballFilter(t))), ...p.sports.map(x => sp.sports?.[x] || [])];
  const ok = (s: Story) => !shown.has(s.id) && !S.read[s.id] && +new Date(s.updated || s.published) >= +since - 24 * 3600_000;
  const out: Story[] = [];
  for (let round = 0; round < 3 && out.length < max; round++) {
    for (const g of groups) {
      const s = g.filter(ok).filter(x => !out.some(o => o.id === x.id || similar(tokens(o.title), tokens(x.title))))[round];
      if (s && out.length < max) out.push(s);
    }
  }
  return out;
}
export function footballFilter(team: string): Story[] {
  const re = new RegExp(`\\b${escapeRe(team)}\\b`, 'i');
  return (data.sport?.sports?.Football || []).filter(s => re.test(s.title));
}

export function build(p: Profile, force = false): Edition {
  const d = now();
  const { slot, date } = currentSlot(p, d);
  const key = `${date}:${slot}`;
  if (!force && store[key]) return store[key];

  // Catch-up: earlier editions today you didn't open are folded into this one
  const slotsToday = enabled(p).filter(s => at(date, timeOf(p, s)) <= d);
  const opened = new Set(Object.values(store).filter(e => e.date === date).map(e => e.slot));
  const merged = slotsToday.filter(s => s !== slot && !opened.has(s));
  const firstToday = !Object.values(store).some(e => e.date === ymd(d) && e.key !== key);
  const last = Object.values(store).filter(e => e.key !== key).sort((a, b) => b.builtAt.localeCompare(a.builtAt))[0];
  const since = new Date(Math.max(+d - 24 * 3600_000, last ? +new Date(last.builtAt) - 30 * 60_000 : +d - 16 * 3600_000));
  const catchup = merged.length > 0;

  const c = context(p);
  const shown = force && store[key] ? new Set<string>() : shownIds();
  const followedUpdates: Card[] = [];
  // Updates on followed stories come first
  const all = dedupe([...(data.news?.stories || []), ...localStories()]);
  for (const f of S.follows) {
    const s = all.find(x => x.id === f.id || x.articles.some(a => f.urls.includes(a.url)));
    if (s && s.articles.length > f.seenCount && !shown.has(`upd-${s.id}-${s.articles.length}`)) followedUpdates.push(storyCard(s, { id: `upd-${s.id}-${s.articles.length}`, followed: true, label: 'Update · Following' }));
  }
  const followedIds = new Set(followedUpdates.map(x => x.story!.id));

  // Knowfeed is a learning app first. News is only what you asked for: breaking headlines, outlets you follow,
  // topics you follow, your area and your sport. Everything else is left out.
  const fresh = (s: Story) => +new Date(s.updated) >= +since && !shown.has(s.id) && !S.read[s.id] && !followedIds.has(s.id) && !avoided(s, c);
  const live = data.live;
  const taken: Story[] = [...followedUpdates.map(x => x.story!)];
  const isNew = (s: Story) => !taken.some(o => o.id === s.id || o.url === s.url || similar(tokens(o.title), tokens(s.title)));
  const take = (list: Story[], n: number) => { const out: Story[] = []; for (const s of list) { if (out.length >= n) break; if (isNew(s)) { out.push(s); taken.push(s); } } return out; };

  // 1. Breaking: the big headlines several outlets lead with (the hourly top stories if offline)
  const breakingSrc = p.breaking === false ? [] : live?.breaking?.length ? live.breaking : (data.news?.stories || []).filter(s => s.importance >= 0.45 || s.top).sort((a, b) => b.importance - a.importance);
  const breakingNow = take(breakingSrc.filter(fresh), catchup ? 3 : 2);
  // 2. Outlets you follow: taking turns, newest first
  const outletLists = Object.values(live?.outlets || {}).map(xs => xs.filter(fresh));
  const outletPicks: Story[] = [];
  for (let round = 0; round < 6 && outletPicks.length < (catchup ? 4 : 3); round++) for (const xs of outletLists) { if (outletPicks.length >= (catchup ? 4 : 3)) break; const s = xs.filter(isNew)[0]; if (s) { outletPicks.push(s); taken.push(s); } }
  // 3. Topics you follow: stories that match your news interests, and live feeds for topics you typed in
  const liveTopic = new Set(Object.values(live?.topics || {}).flat().map(s => s.id));
  const topicPool = [...all.filter(s => s.topic !== 'sport' && s.topic !== 'local'), ...Object.values(live?.topics || {}).flat()].filter(fresh);
  const scored = topicPool.map(s => { const rel = liveTopic.has(s.id) ? 0.9 : relevance(s, c); return { s, rel, base: 0.5 * rel + 0.2 * s.importance + 0.2 * freshness(s, d) + 0.1 * personal(s, c) }; })
    .filter(x => x.rel >= 0.7).sort((a, b) => b.base - a.base);
  // Variety: no more than two from one topic
  const perTopic = new Map<string, number>();
  const topicPicks: Story[] = [];
  for (const x of scored) {
    if (topicPicks.length >= (catchup ? 4 : 3)) break;
    const k = x.s.tags[0] || x.s.topic;
    if ((perTopic.get(k) || 0) >= 2 || !isNew(x.s)) continue;
    topicPicks.push(x.s); taken.push(x.s); perTopic.set(k, (perTopic.get(k) || 0) + 1);
  }
  // 4. Your area, and 5. your sport
  const localPicks = take(localStories().filter(fresh).sort((a, b) => +new Date(b.updated) - +new Date(a.updated)), catchup ? 2 : 1);
  const sportPicks = sportStories(p, since, shown, catchup ? 2 : 1).filter(isNew);

  const newsCards = [
    ...followedUpdates,
    ...breakingNow.map(s => storyCard(s, { must: true })),
    ...[...outletPicks, ...topicPicks, ...localPicks, ...sportPicks].map(s => storyCard(s)),
  ];
  const used = new Set(newsCards.map(x => x.id));
  // Learning is the main part of every edition
  const { learning, light } = learningCards(p, firstToday, Math.max(10, Math.round(newsCards.length * 1.5)), used);
  // If there's less learning than usual, trim the news so it never outweighs it (lowest priority goes first)
  const cap = Math.max(4, learning.length + 2);
  const cut = newsCards.length > cap ? newsCards.splice(cap) : [];

  const cards = weave(newsCards, learning, light);
  const earlier = [...cut.map(x => x.story!).filter(Boolean), ...[...scored.map(x => x.s), ...outletLists.flat()].filter(s => !taken.includes(s) && isNew(s))].slice(0, 12).map(s => storyCard(s));
  const e: Edition = { key, date, slot, builtAt: d.toISOString(), since: since.toISOString(), catchup, merged, cards, earlier };
  store[key] = e;
  persist();
  return e;
}

/* Between editions: a big story that matches your interests appears as "Just in" */
export function justIn(e: Edition, p: Profile): Story | null {
  const c = context(p);
  const inEdition = new Set(e.cards.map(x => x.story?.id).filter(Boolean));
  // Breaking news that several outlets started leading with after this edition was made
  const br = p.breaking === false ? null : (data.live?.breaking || []).find(s => s.via === 'Breaking' && +new Date(s.published) > +new Date(e.builtAt) && !inEdition.has(s.id) && !S.read[s.id] && !avoided(s, c));
  if (br) return br;
  return (data.news?.stories || []).filter(s => +new Date(s.first) > +new Date(e.builtAt) && !inEdition.has(s.id) && !S.read[s.id] && s.importance >= 0.5 && (s.top || relevance(s, c) >= 0.7) && !avoided(s, c))
    .sort((a, b) => b.importance - a.importance)[0] || null;
}

/* A quick preview for the end of onboarding */
export function preview(p: Profile): string[] {
  const e = build(p);
  return e.cards.filter(x => x.kind === 'story').slice(0, 3).map(x => x.story!.title);
}

