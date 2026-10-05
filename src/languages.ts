/* Languages: the launch list, phrase packs (content/phrases/<language>.json) and phrase of the day */
import { load, save, today } from './state';
import * as srs from './srs';
import type { Phrase } from './types';

/* Name, device voice code, and the Wikipedia page about the language */
export const LANGUAGES: [string, string, string][] = [
  ['Spanish', 'es-ES', 'Spanish language'], ['French', 'fr-FR', 'French language'], ['German', 'de-DE', 'German language'],
  ['Italian', 'it-IT', 'Italian language'], ['Portuguese', 'pt-PT', 'Portuguese language'], ['Dutch', 'nl-NL', 'Dutch language'],
  ['Swedish', 'sv-SE', 'Swedish language'], ['Norwegian', 'nb-NO', 'Norwegian language'], ['Danish', 'da-DK', 'Danish language'],
  ['Polish', 'pl-PL', 'Polish language'], ['Romanian', 'ro-RO', 'Romanian language'], ['Greek', 'el-GR', 'Modern Greek'],
  ['Turkish', 'tr-TR', 'Turkish language'], ['Russian', 'ru-RU', 'Russian language'], ['Ukrainian', 'uk-UA', 'Ukrainian language'],
  ['Arabic', 'ar-SA', 'Arabic'], ['Hebrew', 'he-IL', 'Hebrew language'], ['Hindi', 'hi-IN', 'Hindi'], ['Urdu', 'ur-PK', 'Urdu'],
  ['Mandarin Chinese', 'zh-CN', 'Mandarin Chinese'], ['Japanese', 'ja-JP', 'Japanese language'], ['Korean', 'ko-KR', 'Korean language'],
  ['Vietnamese', 'vi-VN', 'Vietnamese language'], ['Thai', 'th-TH', 'Thai language'], ['Indonesian', 'id-ID', 'Indonesian language'],
  ['Irish', 'ga-IE', 'Irish language'], ['Welsh', 'cy-GB', 'Welsh language'],
];
export const BSL = 'British Sign Language';
export const LANG_CODE: Record<string, string> = Object.fromEntries(LANGUAGES.map(([n, c]) => [n, c]));
export const LANG_WIKI: Record<string, string> = { ...Object.fromEntries(LANGUAGES.map(([n, , w]) => [n, w])), [BSL]: 'British Sign Language' };

export const LEVELS: [string, string][] = [['new', 'Completely new'], ['basics', 'Some basics'], ['getting-by', 'Getting by'], ['confident', 'Confident']];
export const GOALS: [string, string][] = [['travel', 'Travel'], ['family', 'Family and friends'], ['work', 'Work'], ['fun', 'Just for fun']];

/* Phrase packs are bundled at build time as their own files, loaded alongside the day's data when the app starts
   (main.ts awaits loadPacks before anything reads them), so they don't weigh down the app's first download */
const files = import.meta.glob('../content/phrases/*.json', { import: 'default' }) as Record<string, () => Promise<Phrase[]>>;
export const PACKS: Record<string, Phrase[]> = {};
let packsLoaded: Promise<void> | null = null;
export function loadPacks(): Promise<void> {
  return packsLoaded ||= Promise.all(Object.entries(files).map(async ([path, get]) => {
    const file = path.split('/').pop()!.replace('.json', '').toLowerCase();
    const lang = LANGUAGES.find(([n]) => n.toLowerCase().replace(/ /g, '-') === file)?.[0];
    const list = await get().catch(() => null);
    if (lang && Array.isArray(list) && list.length) PACKS[lang] = [...list].sort((a, b) => a.level - b.level);
  })).then(() => {});
}
export const hasPack = (lang: string) => !!PACKS[lang]?.length;

/* Goals shape the order: travel starts with getting around, work with work phrases, and so on */
const GOAL_THEMES: Record<string, string[]> = {
  travel: ['getting-around', 'cafe-restaurant', 'shopping-money', 'problems-help'],
  family: ['family-friends', 'at-home', 'feelings-small-talk'],
  work: ['work', 'time-numbers-days'],
  fun: [],
};
/* Level shapes where to start: confident learners skip the very first phrases */
const LEVEL_START: Record<string, number> = { new: 1, basics: 1, 'getting-by': 2, confident: 3 };

export function orderedPack(lang: string, goal = 'fun', level = 'new'): Phrase[] {
  const pack = PACKS[lang] || [];
  const pref = GOAL_THEMES[goal] || [];
  const start = LEVEL_START[level] || 1;
  // Easiest first; within a level, phrases for your goal first; phrases below your level come last
  return [...pack].sort((a, b) =>
    (a.level < start ? 1 : 0) - (b.level < start ? 1 : 0) ||
    a.level - b.level ||
    (pref.includes(b.theme) ? 1 : 0) - (pref.includes(a.theme) ? 1 : 0) ||
    pack.indexOf(a) - pack.indexOf(b));
}

let pod = load<Record<string, { date: string; id: string }>>('pod', {});

/* Today's new phrase: the first one not seen yet, kept the same all day. Seeing it starts its reviews. */
export function phraseOfDay(lang: string, goal?: string, level?: string): Phrase | null {
  const pack = orderedPack(lang, goal, level); if (!pack.length) return null;
  const t = today();
  const cur = pod[lang];
  if (cur?.date === t) return pack.find(p => p.id === cur.id) || null;
  const next = pack.find(p => !srs.get(srs.phraseKey(lang, p)));
  if (!next) return null;
  pod[lang] = { date: t, id: next.id };
  save('pod', pod);
  srs.add(srs.phraseKey(lang, next), 'phrase', { lang });
  return next;
}

/* New phrases for a 5-minute lesson (beyond the phrase of the day) */
export function nextNew(lang: string, n: number, goal?: string, level?: string): Phrase[] {
  return orderedPack(lang, goal, level).filter(p => !srs.get(srs.phraseKey(lang, p))).slice(0, n);
}

export function phraseById(lang: string, id: string) { return PACKS[lang]?.find(p => p.id === id); }
export const progressLine = (lang: string) => { const p = srs.progress(lang, PACKS[lang] || []); return `${lang}: ${p.learned} learned of ${p.total}`; };
export const reloadPod = () => { pod = load('pod', {}); };
