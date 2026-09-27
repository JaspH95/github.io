/* The edition feed: a finite set of full-screen cards, ending with "You're up to date". */
import { S, markSeen, bump, day, remember, dismissed } from './state';
import { esc, ICON, plural } from './ui';
import { render, type Card } from './cards';
import { todays, minutes } from './series';
import { build, markFinished, nextLabel, SLOT_LABEL, justIn, hadBefore, type Edition } from './edition';
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
    if (c?.story) remember(c.story, 'seen');
    progress();
    if (el.dataset.kind === 'done' && edition && !edition.finishedAt) { markFinished(edition); bump('finished'); refreshDone(); }
  }
}, { threshold: [0.6] }) : null;

function progress() {
  const f = feed();
  const cards = [...f.children] as HTMLElement[];
  const i = currentEl ? cards.indexOf(currentEl) : 0;
  // The edition ends at the done card; earlier stories after it don't stretch the bar
  const end = cards.findIndex(c => c.dataset.kind === 'done');
  const last = end >= 0 ? end : cards.length - 1;
  const bar = document.getElementById('prog');
  if (bar) bar.style.width = `${Math.min(100, Math.max(0, (i / Math.max(1, last)) * 100))}%`;
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
  // Stories you've marked as read or said no to are left out, even from an edition you've already opened
  for (const c of e.cards) {
    if ((c.kind as string) === 'sports') continue;   // editions saved before the sports page card was removed
    if (c.story && dismissed(c.story.id)) continue;
    const n = render(c); f.appendChild(n); io?.observe(n);
  }
  const done = doneCard(e);
  f.appendChild(done); io?.observe(done);
  // Past the done card: stories from earlier today you haven't had yet (seen, read, or the same news elsewhere), each tagged "Earlier today"
  const had = hadBefore();
  for (const c of earlierFor(e, had)) { const n = render({ ...c, earlier: true }); f.appendChild(n); io?.observe(n); }
  refreshDone();
  // Coming back to an edition you've started: pick up at the first card you haven't seen, not the top
  const els = [...f.children] as HTMLElement[];
  const started = els.some(n => (n as any)._card && S.seen[(n as any)._card.id]);
  const resume = started ? els.find(n => n.dataset.kind === 'done' || ((n as any)._card && !S.seen[(n as any)._card.id])) : null;
  f.scrollTo({ top: 0 });
  if (resume && resume !== els[0]) requestAnimationFrame(() => { f.scrollTo({ top: resume.offsetTop }); currentEl = resume; progress(); });
  document.getElementById('edLabel')!.textContent = e.catchup ? 'Catch-up' : SLOT_LABEL[e.slot];
  f.setAttribute('aria-label', SLOT_LABEL[e.slot]);
  showJustIn();
}

const earlierFor = (e: Edition, had: ReturnType<typeof hadBefore>) => e.earlier.filter(c => !c.story || !had(c.story));

/* "Mark as read" or "Not interested": the card folds away and the next one takes its place */
document.addEventListener('kf-drop', ev => {
  const el = (ev as CustomEvent<HTMLElement>).detail;
  if (!el?.isConnected) return;
  el.classList.add('dropping');
  setTimeout(() => {
    const next = el.nextElementSibling as HTMLElement | null;
    io?.unobserve(el); el.remove();
    if (currentEl === el) currentEl = next;
    progress(); refreshDone();
  }, 280);
});

function catchupCard(e: Edition): HTMLElement {
  const el = document.createElement('section');
  el.className = 'card plain k-catchup'; el.dataset.kind = 'catchup'; el.dataset.id = `catchup-${e.key}`;
  const names = [...e.merged, e.slot].map(s => SLOT_LABEL[s].replace(' edition', ''));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const stories = e.cards.filter(c => c.kind === 'story').length;
  el.innerHTML = `<div class="aurora soft"></div><div class="inner">
    <p class="kicker">While you were away</p>
    <h2 class="display">Your ${list} editions, in one.</h2>
    <p>${plural(stories, 'story', 'stories')}, the most important first, with learning in between. Anything below the cut comes after, tagged <b>Earlier today</b>.</p>
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
  const ser = S.profile ? todays(S.profile) : null;
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
      ${ser ? `<button class="next-row" data-series="${esc(ser.s.id)}"><span class="ic">${ICON.book}</span><span><b>${esc(ser.s.title)}</b><span>Episode ${ser.e.n} of ${ser.s.episodes.length}: ${esc(ser.e.title)} · ${minutes(ser.e)} min</span></span>${ICON.chev}</button>` : ''}
      ${langs.map(l => `<button class="next-row" data-lesson="${esc(l.name)}"><span class="ic">${ICON.lang}</span><span><b>5-minute ${esc(l.name)} lesson</b><span>${esc(progressLine(l.name))}</span></span>${ICON.chev}</button>`).join('')}
      ${due ? `<button class="next-row" data-review="1"><span class="ic">${ICON.check}</span><span><b>Review ${plural(Math.min(due, 5), 'thing')}</b><span>Quick recall of what you've learned</span></span>${ICON.chev}</button>` : ''}
      <button class="next-row" data-go="learn"><span class="ic">${ICON.book}</span><span><b>Explore your library</b><span>Skills, topics and today's picks</span></span>${ICON.chev}</button>
    </div>
    ${week ? `<div class="recap"><p class="kicker small">Your week</p><p>${week}</p></div>` : ''}
    ${earlierCount() ? `<div class="hint">${ICON.up}Keep scrolling for ${plural(earlierCount(), 'story', 'stories')} from earlier today</div>` : ''}
    <button class="linkish change">Change what you see</button>
  </div>`;
}

const earlierCount = () => feed().querySelectorAll('[data-kind="done"] ~ [data-kind="story"]').length;

function wireDone(el: HTMLElement, e: Edition) {
  el.querySelectorAll<HTMLElement>('[data-lesson]').forEach(b => b.addEventListener('click', () => startLesson(b.dataset.lesson!)));
  el.querySelector('[data-review]')?.addEventListener('click', () => startReview());
  el.querySelector<HTMLElement>('[data-series]')?.addEventListener('click', b => document.dispatchEvent(new CustomEvent('kf-series', { detail: { id: (b.currentTarget as HTMLElement).dataset.series } })));
  el.querySelector('[data-go]')?.addEventListener('click', () => go('learn'));
  el.querySelector('.change')?.addEventListener('click', () => openChat());
}

export function refreshDone() {
  const el = feed().querySelector<HTMLElement>('[data-kind="done"]');
  if (!el || !edition) return;
  el.innerHTML = doneHTML(edition);
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
    case 'learn': return c.learn!.kind === 'fact' ? `Did you know ${c.learn!.hook!.replace(/^…/, '')}` : c.learn!.kind === 'onthisday' ? `On this day in ${c.learn!.year}. ${c.learn!.event}` : `${c.label}. ${c.learn!.title}. ${c.learn!.extract.split(/(?<=\.)\s/).slice(0, 2).join(' ')}`;
    case 'quiz': return `Quiz. ${c.quiz!.q} ${c.quiz!.prompt || ''} ${c.quiz!.opts.join(', or ')}? The answer: ${c.quiz!.opts[c.quiz!.answer]}.`;
    case 'hub': return `${c.label}. ${c.hub!.title}. ${c.hub!.summary}`;
    case 'series': return `A Series episode: ${c.label}.`;
    case 'skill': return `Skill of the day: ${c.skill!.label}.`;
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

