/* The edition feed: a finite set of full-screen cards, ending with "You're up to date". */
import { S, markSeen, bump, day } from './state';
import { esc, ICON, plural } from './ui';
import { render, storyMeta, hl, type Card } from './cards';
import { build, markFinished, nextLabel, SLOT_LABEL, justIn, type Edition } from './edition';
import { hasPack, progressLine } from './languages';
import * as srs from './srs';
import { openStory } from './story';
import { playQueue, stopAudio, isPlaying } from './audio';
import { go } from './nav';
import { startLesson, startReview } from './lessons';
import { openChat } from './chat';
import { weekly, goalLine } from './wellbeing';

export const feed = () => document.getElementById('feed')!;
export let edition: Edition | null = null;
let currentEl: HTMLElement | null = null;

const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting || en.intersectionRatio < 0.6) continue;
    const el = en.target as HTMLElement;
    currentEl = el;
    el.dataset.seen = '1';
    const c: Card | undefined = (el as any)._card;
    if (c && markSeen(c.id) && ['learn', 'skill', 'phrase', 'sign'].includes(c.kind)) bump('learned');
    progress();
    if (el.dataset.kind === 'done' && edition && !edition.finishedAt) { markFinished(edition); bump('finished'); refreshDone(); }
  }
}, { threshold: [0.6] }) : null;

function progress() {
  const f = feed();
  const cards = [...f.children] as HTMLElement[];
  const i = currentEl ? cards.indexOf(currentEl) : 0;
  const bar = document.getElementById('prog');
  if (bar) bar.style.width = `${Math.max(0, (i / Math.max(1, cards.length - 1)) * 100)}%`;
}

/* ---------- Building the feed ---------- */

export function showEdition(force = false) {
  if (!S.profile) return;
  const e = build(S.profile, force);
  const fresh = edition?.key !== e.key;
  edition = e;
  if (fresh) bump('opened');
  const f = feed();
  f.innerHTML = '';
  if (e.catchup) f.appendChild(catchupCard(e));
  for (const c of e.cards) { const n = render(c); f.appendChild(n); io?.observe(n); }
  const done = doneCard(e);
  f.appendChild(done); io?.observe(done);
  f.scrollTo({ top: 0 });
  document.getElementById('edLabel')!.textContent = e.catchup ? 'Catch-up' : SLOT_LABEL[e.slot];
  f.setAttribute('aria-label', SLOT_LABEL[e.slot]);
  showJustIn();
}

function catchupCard(e: Edition): HTMLElement {
  const el = document.createElement('section');
  el.className = 'card plain k-catchup'; el.dataset.kind = 'catchup'; el.dataset.id = `catchup-${e.key}`;
  const names = [...e.merged, e.slot].map(s => SLOT_LABEL[s].replace(' edition', ''));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const stories = e.cards.filter(c => c.kind === 'story').length;
  el.innerHTML = `<div class="aurora soft"></div><div class="inner">
    <p class="kicker">While you were away</p>
    <h2 class="display">Your ${list} editions, in one.</h2>
    <p>${plural(stories, 'story', 'stories')}, the most important first, with learning in between. Anything below the cut is in <b>Earlier today</b> at the end.</p>
    <div class="hint">${ICON.up}Swipe up to start</div></div>`;
  return el;
}

function doneCard(e: Edition): HTMLElement {
  const el = document.createElement('section');
  el.className = 'card plain k-done'; el.dataset.kind = 'done'; el.dataset.id = `done-${e.key}`;
  el.innerHTML = doneHTML(e);
  wireDone(el, e);
  return el;
}

function doneHTML(e: Edition): string {
  const d = day();
  const stories = e.cards.filter(c => c.kind === 'story' && S.seen[c.id]).length;
  const langs = (S.profile?.languages || []).filter(l => hasPack(l.name));
  const due = srs.due({ mark: false, perLang: 99 }).length;
  const week = weekly();
  const goal = goalLine();
  return `<div class="aurora soft"></div><div class="inner done-inner">
    <p class="kicker">${esc(SLOT_LABEL[e.slot])}${e.catchup ? ' · catch-up' : ''}</p>
    <h2 class="display">You're up to date.</h2>
    <p>Next: <b>${esc(nextLabel())}</b>.</p>
    <div class="stats">
      <div><b>${stories}</b><span>${stories === 1 ? 'story' : 'stories'}</span></div>
      <div><b>${d.learned}</b><span>learned today</span></div>
      <div><b>${d.quizDone ? `${d.quizRight}/${d.quizDone}` : '–'}</b><span>quiz</span></div>
    </div>
    ${goal ? `<p class="goal">${esc(goal)}</p>` : ''}
    <p class="kicker small">Keep learning</p>
    <div class="next-list">
      ${langs.map(l => `<button class="next-row" data-lesson="${esc(l.name)}"><span class="ic">${ICON.lang}</span><span><b>5-minute ${esc(l.name)} lesson</b><span>${esc(progressLine(l.name))}</span></span>${ICON.chev}</button>`).join('')}
      ${due ? `<button class="next-row" data-review="1"><span class="ic">${ICON.check}</span><span><b>Review ${plural(Math.min(due, 5), 'thing')}</b><span>Quick recall of what you've learned</span></span>${ICON.chev}</button>` : ''}
      <button class="next-row" data-go="learn"><span class="ic">${ICON.book}</span><span><b>Explore your library</b><span>Skills, topics and today's picks</span></span>${ICON.chev}</button>
    </div>
    ${week ? `<div class="recap"><p class="kicker small">Your week</p><p>${week}</p></div>` : ''}
    ${e.earlier.length ? `<details class="earlier"><summary>Earlier today <span>${e.earlier.length}</span></summary><ul>${e.earlier.map(c => `<li><button data-story="${esc(c.story!.id)}"><span class="m">${storyMeta(c.story!)}</span>${hl(c.story!.title, c.story!.entities)}</button></li>`).join('')}</ul></details>` : ''}
    <button class="linkish change">Change what you see</button>
  </div>`;
}

function wireDone(el: HTMLElement, e: Edition) {
  el.querySelectorAll<HTMLElement>('[data-lesson]').forEach(b => b.addEventListener('click', () => startLesson(b.dataset.lesson!)));
  el.querySelector('[data-review]')?.addEventListener('click', () => startReview());
  el.querySelector('[data-go]')?.addEventListener('click', () => go('learn'));
  el.querySelectorAll<HTMLElement>('[data-story]').forEach(b => b.addEventListener('click', () => { const c = e.earlier.find(x => x.story?.id === b.dataset.story); if (c?.story) openStory(c.story); }));
  el.querySelector('.change')?.addEventListener('click', () => openChat());
}

export function refreshDone() {
  const el = feed().querySelector<HTMLElement>('[data-kind="done"]');
  if (!el || !edition) return;
  const open = el.querySelector('details')?.open;
  el.innerHTML = doneHTML(edition);
  if (open) el.querySelector('details')?.setAttribute('open', '');
  wireDone(el, edition);
}

/* ---------- "Just in" between editions ---------- */

export function showJustIn() {
  const b = document.getElementById('justin')!;
  const s = edition && S.profile ? justIn(edition, S.profile) : null;
  if (!s) { b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = `<button class="jl glass"><span class="tag">Just in</span><span class="t">${esc(s.title)}</span>${ICON.chev}</button><button class="jx" aria-label="Dismiss">${ICON.close}</button>`;
  b.querySelector('.jl')!.addEventListener('click', () => { b.hidden = true; openStory(s); });
  b.querySelector('.jx')!.addEventListener('click', () => { b.hidden = true; });
}

/* ---------- Listen: read the edition aloud, card by card ---------- */

function speechFor(c: Card): string | null {
  switch (c.kind) {
    case 'story': { const s = c.story!; return `${c.label}. ${s.title}. ${s.summary ? s.summary.gist.join(' ') : s.standfirst}`; }
    case 'learn': return c.learn!.kind === 'onthisday' ? `On this day in ${c.learn!.year}. ${c.learn!.event}` : `${c.label}. ${c.learn!.title}. ${c.learn!.extract.split(/(?<=\.)\s/).slice(0, 2).join(' ')}`;
    case 'quiz': return `Quiz. ${c.quiz!.q} ${c.quiz!.prompt || ''} ${c.quiz!.opts.join(', or ')}? The answer: ${c.quiz!.opts[c.quiz!.answer]}.`;
    case 'hub': return `${c.label}. ${c.hub!.title}. ${c.hub!.summary}`;
    case 'skill': return `Skill of the day: ${c.skill!.label}.`;
    case 'sports': return `Sports page. ${[...c.sports!.teams.map(t => `${t.team}: ${t.stories[0].title}`), ...c.sports!.headlines.map(s => s.title)].join('. ')}`;
    default: return null;
  }
}

function listenFrom(el: HTMLElement | null) {
  while (el && !speechFor((el as any)._card || {})) el = el.nextElementSibling as HTMLElement | null;
  if (!el || el.dataset.kind === 'done') { stopAudio(); return false; }
  const c: Card = (el as any)._card;
  feed().scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  currentEl = el;
  playQueue([{ text: speechFor(c)!, label: c.story?.title || c.learn?.title || c.label }], { next: () => { setTimeout(() => listenFrom(el!.nextElementSibling as HTMLElement | null), 400); return true; } });
  return true;
}

export function toggleListen() {
  if (isPlaying()) { stopAudio(); return; }
  go('edition');
  const start = currentEl && (currentEl as any)._card ? currentEl : (feed().firstElementChild as HTMLElement | null);
  listenFrom(start);
}

export function initFeed() {
  document.getElementById('listenAll')!.addEventListener('click', toggleListen);
  // Keep the progress bar honest while scrolling
  feed().addEventListener('scroll', () => { if (!currentEl) progress(); }, { passive: true });
}

/* Did the edition roll over (a new slot has started)? */
export function stale(): boolean {
  if (!edition || !S.profile) return true;
  const e = build(S.profile);
  return e.key !== edition.key;
}

