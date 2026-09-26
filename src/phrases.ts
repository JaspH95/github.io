import { PACKS } from './content';
import { load, save, today, addDays } from './state';
import type { Phrase } from './types';

/* Spaced repetition, all on the device: reviews after 1, 3, 7, 14 and 30 days */
const STEPS = [1, 3, 7, 14, 30];

interface Progress { seen: string; step: number; due: string; learned: boolean }
type Store = Record<string, Record<string, Progress>>;       // language -> phrase id -> progress

let store: Store = load<Store>('kf-phrases', {});
let pod = load<Record<string, { date: string; id: string }>>('kf-pod', {});
let reviewsShown = load<{ date: string; counts: Record<string, string[]> }>('kf-rev', { date: '', counts: {} });
const persist = () => { save('kf-phrases', store); save('kf-pod', pod); save('kf-rev', reviewsShown); };

export const hasPack = (lang: string) => !!PACKS[lang]?.length;

/* Today's new phrase: the first one not seen yet, kept the same all day */
export function phraseOfDay(lang: string): Phrase | null {
  const pack = PACKS[lang]; if (!pack) return null;
  const t = today();
  const cur = pod[lang];
  if (cur?.date === t) return pack.find(p => p.id === cur.id) || null;
  const mine = store[lang] || {};
  const next = pack.find(p => !mine[p.id]);
  if (!next) return null;
  pod[lang] = { date: t, id: next.id };
  // Seeing it counts as the first step; the first review is tomorrow
  store[lang] = { ...mine, [next.id]: { seen: t, step: 0, due: addDays(t, STEPS[0]), learned: false } };
  persist();
  return next;
}

/* Up to 3 "Remember this?" cards a day per language */
export function reviewsDue(lang: string, max = 3): Phrase[] {
  const pack = PACKS[lang]; if (!pack) return [];
  const t = today();
  if (reviewsShown.date !== t) reviewsShown = { date: t, counts: {} };
  const already = reviewsShown.counts[lang] || [];
  const mine = store[lang] || {};
  const due = pack.filter(p => mine[p.id] && !mine[p.id].learned && mine[p.id].due <= t && pod[lang]?.id !== p.id && !already.includes(p.id));
  const pick = [...pack.filter(p => already.includes(p.id) && mine[p.id]?.due <= t), ...due].slice(0, max);
  reviewsShown.counts[lang] = [...new Set([...already, ...pick.map(p => p.id)])].slice(0, max);
  persist();
  return pick;
}

export function answerReview(lang: string, id: string, gotIt: boolean) {
  const t = today();
  const p = store[lang]?.[id]; if (!p) return;
  if (gotIt) {
    const step = p.step + 1;
    // Passing the 30-day review means it's learned
    if (step >= STEPS.length) store[lang][id] = { ...p, step, learned: true, due: '9999-12-31' };
    else store[lang][id] = { ...p, step, due: addDays(t, STEPS[step]) };
  } else {
    store[lang][id] = { ...p, step: 0, due: addDays(t, STEPS[0]) };
  }
  persist();
}

export function progress(lang: string) {
  const pack = PACKS[lang] || [];
  const mine = store[lang] || {};
  const learned = pack.filter(p => mine[p.id]?.learned).length;
  const seen = pack.filter(p => mine[p.id]).length;
  return { learned, seen, total: pack.length, finished: pack.length > 0 && seen >= pack.length };
}
export const progressLine = (lang: string) => { const p = progress(lang); return `${lang}: ${p.learned} learned of ${p.total}`; };

export const seenPhrases = (lang: string): Phrase[] => (PACKS[lang] || []).filter(p => store[lang]?.[p.id]);

/* Pack finished: start every phrase's reviews again from the first step */
export function reviewAllAgain(lang: string) {
  const t = today();
  const pack = PACKS[lang] || [];
  // Spread them out so reviews don't all land on one day
  store[lang] = Object.fromEntries(pack.map((p, i) => [p.id, { seen: t, step: 0, due: addDays(t, 1 + Math.floor(i / 3)), learned: false }]));
  persist();
}

export function exportPhrases() { return { store, pod }; }
export function importPhrases(d: any) {
  if (d?.store) store = d.store;
  if (d?.pod) pod = d.pod;
  persist();
}
