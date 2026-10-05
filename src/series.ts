/* Series: Imprint-style short courses. A few episodes each, five to eight cards per episode, read one card at a
   time: tap the right of the screen to go on, the left to go back. Written by Claude Code from the cited sources in
   content/series/, and only shown to testers once Jasper has reviewed them (language Series show "Not yet checked"). */
import { S, load, save, today, bump, persist as persistState, type Profile } from './state';
import { esc, ICON, toast } from './ui';
import { PACKS, LANG_CODE } from './languages';
import { speakIn } from './audio';
import * as srs from './srs';
import { log } from './events';
import { feedback } from './feedback';

export interface SeriesCard {
  type: 'title' | 'idea' | 'fact' | 'example' | 'tip' | 'quote' | 'check' | 'recap' | 'phrase';
  big?: string; text?: string; who?: string; src?: string[];
  q?: string; opts?: string[]; answer?: number; explain?: string;
  points?: string[]; id?: string;
}
export interface Episode { n: number; title: string; cards: SeriesCard[] }
export interface Series {
  id: string; title: string; kind: 'idea' | 'history' | 'skill' | 'book' | 'language'; topic: string; lang?: string;
  interests: string[]; areas?: string[]; colours: [string, string]; blurb: string; reviewed: boolean;
  sources: { id: string; title: string; url: string }[]; episodes: Episode[]; book?: { author: string; translator?: string; text: string };
}

/* Loaded alongside the day's data when the app starts (main.ts awaits loadSeries), as separate files */
const files = import.meta.glob('../content/series/*.json', { import: 'default' }) as Record<string, () => Promise<Series>>;
export const SERIES: Series[] = [];
let seriesLoaded: Promise<void> | null = null;
export function loadSeries(): Promise<void> {
  return seriesLoaded ||= Promise.all(Object.values(files).map(get => get().catch(() => null))).then(list => {
    SERIES.splice(0, SERIES.length, ...(list.filter(Boolean) as Series[]).sort((a, b) => a.title.localeCompare(b.title)));
  });
}
export const seriesById = (id: string) => SERIES.find(s => s.id === id);

/* ---------- Progress (synced with the account) ---------- */

type Progress = Record<string, { done: number[]; last?: string }>;
let progress = load<Progress>('series', {});
const persist = () => save('series', progress);
export const doneEpisodes = (id: string) => progress[id]?.done || [];
export const nextEpisode = (s: Series) => s.episodes.find(e => !doneEpisodes(s.id).includes(e.n)) || null;
export const finished = (s: Series) => !nextEpisode(s);
export const minutes = (e: Episode) => Math.max(2, Math.round(e.cards.length * 0.45));

/* Drafts are hidden from testers; Jasper turns them on in the developer menu to review them */
export const showDrafts = () => load<boolean>('series-drafts', false);
export const setShowDrafts = (on: boolean) => save('series-drafts', on);
export const isDraft = (s: Series) => !s.reviewed && s.kind !== 'language';

/* The Series someone can see: reviewed ones (or drafts when reviewing), and language Series for languages they learn */
export function available(p: Profile): Series[] {
  return SERIES.filter(s => (s.reviewed || s.kind === 'language' || showDrafts()) && (s.kind !== 'language' || p.languages.some(l => l.name === s.lang)));
}
/* Best first: ones already started, then the best match for their interests and work */
export function forYou(p: Profile): Series[] {
  const learn = new Set(p.interests.filter(i => i.mode !== 'news').map(i => i.id));
  const all = new Set(p.interests.map(i => i.id));
  const areas = new Set(p.job?.areas || []);
  const score = (s: Series) => (doneEpisodes(s.id).length && !finished(s) ? 100 : 0) + (s.kind === 'language' ? 20 : 0)
    + s.interests.filter(i => learn.has(i)).length * 3 + s.interests.filter(i => all.has(i)).length + (s.areas || []).filter(a => areas.has(a)).length * 3;
  return available(p).filter(s => !finished(s)).map(s => ({ s, v: score(s) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).map(x => x.s);
}
/* The episode to offer today: one a day per Series keeps it digestible */
export function todays(p: Profile): { s: Series; e: Episode } | null {
  for (const s of forYou(p)) {
    if (progress[s.id]?.last === today()) continue;
    const e = nextEpisode(s); if (e) return { s, e };
  }
  return null;
}

/* ---------- The player ---------- */

const el = () => document.getElementById('series')!;
let cur: { s: Series; e: Episode; i: number; answered: Set<number> } | null = null;

export function playEpisode(id: string, n?: number) {
  const s = seriesById(id); if (!s) return;
  const e = s.episodes.find(x => x.n === n) || nextEpisode(s) || s.episodes[0];
  cur = { s, e, i: 0, answered: new Set() };
  const root = el();
  root.style.setProperty('--c1', s.colours[0]); root.style.setProperty('--c2', s.colours[1]);
  root.classList.add('open'); root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('series-open');
  draw();
}
export function closeSeries() {
  el().classList.remove('open'); el().setAttribute('aria-hidden', 'true');
  document.body.classList.remove('series-open');
  cur = null;
}

const LABEL: Record<string, string> = { idea: 'The idea', fact: 'Fact', example: 'For example', tip: 'Try this', quote: 'In their words', check: 'Quick check', recap: 'In short' };

function sourceLine(s: Series, c: SeriesCard): string {
  if (c.type === 'phrase') return `From Knowfeed’s ${esc(s.lang || '')} phrase pack · not yet checked by a native speaker`;
  const src = (c.src || []).map(id => s.sources.find(x => x.id === id)).filter(Boolean) as Series['sources'];
  if (!src.length) return '';
  return `Source: ${src.map(x => x.url.includes('knowfeed') ? esc(x.title) : `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(', ')}`;
}

function cardHTML(s: Series, e: Episode, c: SeriesCard): string {
  switch (c.type) {
    case 'title': return `<p class="sp-kicker">Episode ${e.n} of ${s.episodes.length} · ${esc(s.title)}</p><h2 class="sp-big">${esc(c.big || e.title)}</h2><p class="sp-text">${esc(c.text || '')}</p>`;
    case 'quote': return `<p class="sp-kicker">${LABEL.quote}</p><blockquote class="sp-quote">“${esc(c.text || '')}”</blockquote><p class="sp-who">${esc(s.book?.author || '')}${c.who ? ` · ${esc(c.who)}` : ''}${s.book?.translator ? `<br><span>Translated by ${esc(s.book.translator)}</span>` : ''}</p>`;
    case 'check': return `<p class="sp-kicker">${LABEL.check}</p><h3 class="sp-q">${esc(c.q || '')}</h3><div class="sp-opts">${(c.opts || []).map((o, k) => `<button class="sp-opt" data-k="${k}">${esc(o)}</button>`).join('')}</div><p class="sp-explain" hidden>${esc(c.explain || '')}</p>`;
    case 'recap': return `<p class="sp-kicker">${LABEL.recap}</p><h3 class="sp-q">${esc(e.title)}</h3><ul class="sp-points">${(c.points || []).map(p => `<li>${ICON.check}<span>${esc(p)}</span></li>`).join('')}</ul>`;
    case 'phrase': {
      const p = PACKS[s.lang || '']?.find(x => x.id === c.id);
      if (!p) return `<p class="sp-text">This phrase isn’t in the pack any more.</p>`;
      return `<p class="sp-kicker">${esc(s.lang || '')} · Say it like this</p>${p.checked ? '' : '<span class="unchecked">Not yet checked</span>'}
        <h2 class="sp-big phrase" lang="${esc(LANG_CODE[s.lang || ''] || '')}">${esc(p.phrase)}</h2>${p.romanisation ? `<p class="sp-text"><i>${esc(p.romanisation)}</i></p>` : ''}
        <p class="sp-say">Say it: <b>${esc(p.say)}</b></p><p class="sp-text"><b>${esc(p.meaning)}</b>. ${esc(p.when)}</p>
        <div class="sp-hear"><button class="sp-btn hear">${ICON.speaker} Hear it</button><button class="sp-btn slow">Slowly</button></div>`;
    }
    default: return `<p class="sp-kicker">${esc(LABEL[c.type] || '')}</p>${c.big ? `<h2 class="sp-big ${c.type === 'fact' ? 'num' : ''}">${esc(c.big)}</h2>` : ''}<p class="sp-text">${esc(c.text || '')}</p>`;
  }
}

function endHTML(s: Series): string {
  const next = nextEpisode(s);
  return `<p class="sp-kicker">${esc(s.title)}</p><h2 class="sp-big">${next ? 'Episode done' : 'Series complete'}</h2>
    <p class="sp-text">${next ? `${doneEpisodes(s.id).length} of ${s.episodes.length} episodes done. Next: <b>${esc(next.title)}</b>.` : `You’ve finished all ${s.episodes.length} episodes. Nicely done.`}</p>
    ${isDraft(s) ? `<div class="sp-review"><p>This Series is a draft for review. Is it right?</p><div class="sp-hear"><button class="sp-btn good">Looks good</button><button class="sp-btn wrong">Something’s wrong</button></div></div>` : ''}
    <div class="sp-actions">${next ? `<button class="sp-btn primary nextep">Next episode · ${minutes(next)} min</button>` : ''}<button class="sp-btn done">Done</button></div>`;
}

function draw() {
  if (!cur) return;
  const { s, e, i } = cur;
  const atEnd = i >= e.cards.length;
  const c = e.cards[i];
  const root = el();
  root.innerHTML = `<div class="sp-top"><div class="sp-bars" aria-hidden="true">${e.cards.map((_, k) => `<i class="${k < i ? 'full' : k === i ? 'now' : ''}"></i>`).join('')}</div><button class="sp-close" aria-label="Close">${ICON.close}</button></div>
    <div class="sp-body${atEnd ? ' end' : ''} is-${atEnd ? 'end' : c.type}">${atEnd ? endHTML(s) : cardHTML(s, e, c)}</div>
    <p class="sp-src">${atEnd ? (isDraft(s) ? 'Draft · not yet reviewed' : '') : sourceLine(s, c)}</p>
    ${atEnd ? '' : `<button class="sp-zone prev" aria-label="Back"></button><button class="sp-zone next" aria-label="Next"></button>`}`;
  root.querySelector('.sp-close')!.addEventListener('click', closeSeries);
  root.querySelector('.sp-zone.prev')?.addEventListener('click', () => { if (cur && cur.i > 0) { cur.i--; draw(); } });
  root.querySelector('.sp-zone.next')?.addEventListener('click', () => advance());
  if (!atEnd && c.type === 'check') {
    const answered = cur.answered.has(i);
    root.querySelectorAll<HTMLButtonElement>('.sp-opt').forEach(b => {
      if (answered) mark(root, c);
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        if (!cur || cur.answered.has(i)) return;
        cur.answered.add(i);
        const right = +b.dataset.k! === c.answer;
        bump('quizDone'); if (right) bump('quizRight');
        b.classList.add(right ? 'right' : 'wrong');
        mark(root, c);
      });
    });
  }
  if (!atEnd && c.type === 'phrase') {
    const p = PACKS[s.lang || '']?.find(x => x.id === c.id);
    if (p) {
      srs.add(srs.phraseKey(s.lang!, p), 'phrase', { lang: s.lang });   // phrases met in a Series come back as reviews
      root.querySelector('.hear')?.addEventListener('click', ev => { ev.stopPropagation(); speakIn(p.phrase, s.lang!, 0.9); });
      root.querySelector('.slow')?.addEventListener('click', ev => { ev.stopPropagation(); speakIn(p.phrase, s.lang!, 0.55); });
    }
  }
  if (atEnd) {
    root.querySelector('.nextep')?.addEventListener('click', () => { const n = nextEpisode(s); if (n) { cur = { s, e: n, i: 0, answered: new Set() }; draw(); } });
    root.querySelector('.done')?.addEventListener('click', closeSeries);
    root.querySelector('.good')?.addEventListener('click', () => { S.feedback.unshift({ at: new Date().toISOString(), item: `series:${s.id}`, title: s.title, text: `Series review: looks good (episode ${e.n})` }); persistState.feedback(); toast('Thanks. Noted as reviewed'); });
    root.querySelector('.wrong')?.addEventListener('click', () => feedback(`series:${s.id}:${e.n}`, `${s.title}, episode ${e.n}`));
  }
}

function mark(root: HTMLElement, c: SeriesCard) {
  root.querySelectorAll<HTMLButtonElement>('.sp-opt').forEach(b => { b.disabled = true; if (+b.dataset.k! === c.answer) b.classList.add('right'); });
  root.querySelector('.sp-explain')?.removeAttribute('hidden');
}

function advance() {
  if (!cur) return;
  const { s, e, i } = cur;
  const c = e.cards[i];
  if (c?.type === 'check' && !cur.answered.has(i)) { toast('Pick an answer first'); return; }
  cur.i++;
  if (cur.i === e.cards.length) complete(s, e);
  draw();
}

function complete(s: Series, e: Episode) {
  const p = progress[s.id] || { done: [] };
  if (!p.done.includes(e.n)) { p.done.push(e.n); bump('learned'); }
  p.last = today();
  progress[s.id] = p; persist();
  log('series_episode', { series: s.id, n: e.n });
  if (finished(s)) log('series_finish', { series: s.id });
}

export function initSeries() {
  // Cards in the feed and other pages ask for an episode with an event, so they don't import this file
  document.addEventListener('kf-series', ev => { const d = (ev as CustomEvent<{ id: string; n?: number }>).detail; playEpisode(d.id, d.n); });
  document.addEventListener('keydown', ev => {
    if (!cur) return;
    if (ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); advance(); }
    if (ev.key === 'ArrowLeft' && cur.i > 0) { cur.i--; draw(); }
    if (ev.key === 'Escape') closeSeries();
  });
  // Progress may have arrived from another phone
  window.addEventListener('storage', () => { progress = load<Progress>('series', {}); });
}
export const reloadSeries = () => { progress = load<Progress>('series', {}); };
