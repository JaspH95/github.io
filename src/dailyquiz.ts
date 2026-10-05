/* The daily quiz: five questions, made only from data, never invented.
   - Wikidata facts and "In which year?" questions from Wikipedia's On this day (the pipeline's quizzes)
   - Inventions: who invented it and when, from Wikidata (wrong answers are other inventors and nearby years)
   - On this day cards: the year, with nearby years as the other choices
   Things you've read this week come first, so it doubles as a check of what stuck. The same five all day. */
import { data } from './data';
import { S, load, save, today } from './state';
import { listOf, yearText } from './cards';
import type { LearnCard } from './types';

export interface DQ { id: string; q: string; prompt?: string; opts: string[]; answer: number; explain: string; source: { name: string; url: string } }

function rng(seed: number) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const shuffle = <T>(xs: T[], r: () => number) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const daySeed = () => [...today()].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647;

function years(y: number, r: () => number): number[] {
  const now = new Date().getFullYear();
  const offs = shuffle([-40, -25, -15, -10, -6, -4, 4, 6, 10, 15, 25, 40], r);
  const out: number[] = [];
  for (const o of offs) { const v = y + o; if (v <= now && v !== y && !out.includes(v)) out.push(v); if (out.length === 2) break; }
  return out;
}
function mc(right: string, wrong: string[], r: () => number) {
  const opts = shuffle([right, ...wrong.slice(0, 2)], r);
  return { opts, answer: opts.indexOf(right) };
}

export function dailyQuestions(): DQ[] {
  const r = rng(daySeed());
  const cards = data.learn?.cards || [];
  const read = (c: LearnCard) => !!S.read[c.id];
  const out: DQ[] = [];
  const inventions = cards.filter(c => c.kind === 'invention' && c.year !== undefined && c.by?.length);
  // Inventions you've read first
  for (const c of [...inventions.filter(read), ...shuffle(inventions.filter(c => !read(c)), r)].slice(0, 2)) {
    if (r() < 0.5) {
      const others = inventions.filter(o => o !== c && !o.by!.some(b => c.by!.includes(b))).map(o => listOf(o.by!));
      if (others.length < 2) continue;
      const { opts, answer } = mc(listOf(c.by!), shuffle(others, r), r);
      out.push({ id: `dq-who-${c.id}`, q: `Who invented the ${c.title.replace(/^(The|A|An) /, '').toLowerCase() === c.title.toLowerCase() ? c.title : c.title}?`, opts, answer, explain: `${c.title}: ${listOf(c.by!)}, ${yearText(c.year)}.`, source: { name: 'Wikidata', url: c.url } });
    } else {
      const ys = years(c.year!, r);
      const { opts, answer } = mc(yearText(c.year), ys.map(yearText), r);
      out.push({ id: `dq-when-${c.id}`, q: `When was this invented?`, prompt: c.title, opts, answer, explain: `${c.title} dates from ${yearText(c.year)}${c.by?.length ? `, by ${listOf(c.by)}` : ''}.`, source: { name: 'Wikidata', url: c.url } });
    }
  }
  // On this day
  const otd = cards.filter(c => c.kind === 'onthisday' && c.year && c.event && !c.event.includes(String(c.year)));
  for (const c of [...otd.filter(read), ...shuffle(otd.filter(c => !read(c)), r)].slice(0, 1)) {
    const ys = years(c.year!, r);
    const { opts, answer } = mc(String(c.year), ys.map(String), r);
    out.push({ id: `dq-otd-${c.id}`, q: 'In which year did this happen?', prompt: c.event, opts, answer, explain: `It happened in ${c.year}.`, source: { name: 'Wikipedia, On this day', url: c.url } });
  }
  // Wikidata facts and On this day questions from the pipeline
  for (const q of shuffle(data.learn?.quizzes || [], r)) {
    if (out.length >= 5) break;
    if (q.opts.length < 2) continue;
    out.push({ id: `dq-${q.id}`, q: q.q, prompt: q.prompt, opts: q.opts, answer: q.answer, explain: q.explain, source: q.source });
  }
  return shuffle(out, r).slice(0, 5);
}

/* Today's result, so the quiz shows as done and the score appears in the recap */
interface Result { date: string; right: number; total: number }
export const quizResult = (): Result | null => { const x = load<Result | null>('dq', null); return x && x.date === today() ? x : null; };
export function saveQuizResult(right: number, total: number) {
  save('dq', { date: today(), right, total });
  const hist = load<Record<string, [number, number]>>('dq-history', {});
  hist[today()] = [right, total];
  save('dq-history', hist);
}
export const quizHistory = () => load<Record<string, [number, number]>>('dq-history', {});
