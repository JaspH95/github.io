/* Spaced repetition, all on the device: reviews after 1, 3, 7, 14 and 30 days.
   "Not yet" sends an item back to the 1-day step; passing the 30-day review means it's learned.
   Used for phrases, quiz questions you got wrong, and skills. */
import { load, save, today, addDays } from './state';
import type { Phrase, Quiz } from './types';

export const STEPS = [1, 3, 7, 14, 30];

export type ItemKind = 'phrase' | 'quiz' | 'skill';
export interface Item {
  key: string;                // phrase:<lang>:<id>, quiz:<id>, skill:<id>
  kind: ItemKind;
  seen: string;
  step: number;
  due: string;
  learned: boolean;
  lang?: string;
  quiz?: Quiz;                // kept whole: quizzes change daily
  skill?: { id: string; label: string };
}

let items = load<Record<string, Item>>('srs', {});
let shown = load<{ date: string; keys: string[] }>('srs-shown', { date: '', keys: [] });
const persist = () => { save('srs', items); save('srs-shown', shown); };

export const get = (key: string) => items[key];
export const all = () => Object.values(items);

export function add(key: string, kind: ItemKind, extra: Partial<Item> = {}) {
  if (items[key]) return items[key];
  const t = today();
  items[key] = { key, kind, seen: t, step: 0, due: addDays(t, STEPS[0]), learned: false, ...extra };
  persist();
  return items[key];
}

export function answer(key: string, gotIt: boolean) {
  const it = items[key]; if (!it) return;
  const t = today();
  if (gotIt) {
    const step = it.step + 1;
    items[key] = step >= STEPS.length ? { ...it, step, learned: true, due: '9999-12-31' } : { ...it, step, due: addDays(t, STEPS[step]) };
  } else items[key] = { ...it, step: 0, due: addDays(t, STEPS[0]) };
  persist();
}

/* Items due today. `perLang` caps phrase reviews per language per day (3 by default). */
export function due(opts: { kind?: ItemKind; lang?: string; max?: number; perLang?: number; mark?: boolean } = {}): Item[] {
  const t = today();
  if (shown.date !== t) shown = { date: t, keys: [] };
  const perLang = opts.perLang ?? 3;
  const counts: Record<string, number> = {};
  shown.keys.forEach(k => { const it = items[k]; if (it?.lang) counts[it.lang] = (counts[it.lang] || 0) + 1; });
  const out: Item[] = [];
  const list = Object.values(items)
    .filter(it => !it.learned && it.due <= t && it.seen < t && (!opts.kind || it.kind === opts.kind) && (!opts.lang || it.lang === opts.lang))
    .sort((a, b) => a.due.localeCompare(b.due));
  for (const it of list) {
    if (opts.max !== undefined && out.length >= opts.max) break;
    if (it.lang && !shown.keys.includes(it.key)) { if ((counts[it.lang] || 0) >= perLang) continue; counts[it.lang] = (counts[it.lang] || 0) + 1; }
    out.push(it);
  }
  if (opts.mark !== false) { shown.keys = [...new Set([...shown.keys, ...out.map(i => i.key)])]; persist(); }
  return out;
}

export const phraseKey = (lang: string, p: Phrase) => `phrase:${lang}:${p.id}`;

export function progress(lang: string, pack: Phrase[]) {
  const learned = pack.filter(p => items[phraseKey(lang, p)]?.learned).length;
  const seen = pack.filter(p => items[phraseKey(lang, p)]).length;
  return { learned, seen, total: pack.length, finished: pack.length > 0 && seen >= pack.length };
}

/* Pack finished: every phrase's reviews start again, spread out so they don't all land on one day */
export function reviewAllAgain(lang: string, pack: Phrase[]) {
  const t = today();
  pack.forEach((p, i) => { items[phraseKey(lang, p)] = { key: phraseKey(lang, p), kind: 'phrase', lang, seen: addDays(t, -1), step: 0, due: addDays(t, 1 + Math.floor(i / 3)), learned: false }; });
  persist();
}

export function clearAll() { items = {}; shown = { date: '', keys: [] }; persist(); }
export const reload = () => { items = load('srs', {}); shown = load('srs-shown', { date: '', keys: [] }); };
