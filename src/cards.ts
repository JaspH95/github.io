/* Feed cards: every kind of card, rendered full screen with its photo (or designed cover),
   text bottom-left and the actions bottom-right. */
import { S, persist, bump, isSaved, nudge, now, type SavedItem } from './state';
import { esc, safeUrl, ago, sentences, toast, seedFor, options, ICON } from './ui';
import { cover } from './covers';
import { signSVG } from './scenes';
import { PACKS, progressLine, LANG_CODE } from './languages';
import { afterLike, offer } from './suggest';
import { seriesById, doneEpisodes, minutes, isDraft } from './series';
import * as srs from './srs';
import { speakIn } from './audio';
import { openStory, openLearn, openSkill } from './story';
import { feedback } from './feedback';
import { markDone, notInterested, knowThis } from './dismiss';
import { storyLabel } from './data';
import type { Story, LearnCard, Quiz, HubItem, TopicKey, Entity } from './types';

export type Kind = 'story' | 'learn' | 'quiz' | 'skill' | 'phrase' | 'review' | 'sign' | 'hub' | 'series' | 'catchup' | 'done';
export interface Card {
  id: string;
  kind: Kind;
  topic: TopicKey;
  label: string;
  story?: Story;
  learn?: LearnCard;
  quiz?: Quiz;
  skill?: { id: string; label: string };
  phrase?: { lang: string; id: string };
  series?: { id: string; n: number };
  review?: string;
  hub?: HubItem;
  must?: boolean;
  earlier?: boolean;           // shown after the done card
  followed?: boolean;
}

/* ---------- Text helpers ---------- */

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* Names of people, places and things in light blue, like Particle */
export function hl(text: string, entities?: Entity[]): string {
  const safe = esc(text);
  if (!entities?.length) return safe;
  const names = [...new Set(entities.map(e => e.name))].filter(n => n.length > 2).sort((a, b) => b.length - a.length).map(n => esc(n));
  if (!names.length) return safe;
  const re = new RegExp(`(?<![\\p{L}>])(${names.map(escRe).join('|')})(?![\\p{L}])`, 'gu');
  return safe.replace(re, '<span class="ent">$1</span>');
}

export function storyMeta(s: Story): string {
  const n = new Set(s.articles.map(a => a.outlet)).size;
  const updated = s.timeline && s.timeline.length > 1 && +new Date(s.updated) - +new Date(s.first) > 3600_000;
  return `${esc(storyLabel(s).toUpperCase())} · ${updated ? 'UPDATED ' : ''}${ago(s.updated, true)}${n > 1 ? ` · ${n} SOURCES` : ` · ${esc(s.outlet.toUpperCase())}`}`;
}

/* ---------- Backgrounds ---------- */

export function photo(url: string | undefined, c: { topic: TopicKey; id: string; label?: string }, img?: { lqip?: string; focus?: [number, number] }, cls = 'scene'): string {
  if (!url) return cover(c.topic, seedFor(c.id), c.label);
  const pos = img?.focus ? `object-position:${img.focus[0]}% ${img.focus[1]}%;` : '';
  const ph = img?.lqip ? `background-image:url(${img.lqip});` : '';
  return `<img class="${cls} photo" src="${safeUrl(url)}" alt="" decoding="async" loading="lazy" referrerpolicy="no-referrer" style="${pos}${ph}" data-topic="${c.topic}" data-seed="${seedFor(c.id)}" data-label="${esc(c.label || '')}">`;
}
/* Feed cards are tall and most photos are wide. Filling the card would zoom a wide photo in about four times,
   so wide photos sit whole at the top over a blurred, darkened copy of themselves. Tall photos still fill the card. */
export function framed(url: string | undefined, c: { topic: TopicKey; id: string; label?: string }, img?: { lqip?: string; focus?: [number, number]; w?: number; h?: number }): string {
  if (!url) return cover(c.topic, seedFor(c.id), c.label);
  const ar = img?.w && img?.h ? img.w / img.h : 0;
  if (ar && ar < 0.9) return photo(url, c, img);
  const pos = img?.focus ? `object-position:${img.focus[0]}% ${img.focus[1]}%;` : '';
  const ph = img?.lqip ? `background-image:url(${img.lqip});` : '';
  return `<div class="frame"${ar ? ` style="--ar:${Math.min(2, ar).toFixed(3)}"` : ''}><img class="bg" src="${img?.lqip && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(img.lqip) ? img.lqip : safeUrl(url)}" alt="" aria-hidden="true" referrerpolicy="no-referrer"><img class="fg photo" src="${safeUrl(url)}" alt="" decoding="async" loading="lazy" referrerpolicy="no-referrer" style="${pos}${ph}" data-topic="${c.topic}" data-seed="${seedFor(c.id)}" data-label="${esc(c.label || '')}"></div>`;
}
/* If a photo fails to load, the topic's cover takes its place */
export function fixImages(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>('img.photo').forEach(img => {
    const frame = img.closest<HTMLElement>('.frame');
    const swap = () => { const t = document.createElement('div'); t.innerHTML = cover(img.dataset.topic as TopicKey, +(img.dataset.seed || 1), img.dataset.label); (frame || img).replaceWith(t.firstElementChild!); };
    if (img.complete && img.naturalWidth === 0 && img.src) swap(); else img.addEventListener('error', swap, { once: true });
    const loaded = () => {
      img.classList.add('loaded');
      if (frame && img.naturalWidth) {
        const ar = img.naturalWidth / img.naturalHeight;
        if (ar < 0.9) frame.classList.add('tall'); else if (!frame.style.getPropertyValue('--ar')) frame.style.setProperty('--ar', Math.min(2, ar).toFixed(3));
      }
    };
    if (img.complete && img.naturalWidth) loaded(); else img.addEventListener('load', loaded, { once: true });
  });
}

function background(c: Card): string {
  switch (c.kind) {
    case 'story': return framed(c.story!.image?.url, { ...c, label: c.label }, c.story!.image);
    case 'learn': return framed(c.learn!.image, { ...c, label: c.label });
    case 'hub': return framed(c.hub!.image, c);
    case 'quiz': return framed(c.quiz!.article?.image, { ...c, label: 'Quiz' });
    case 'sign': return signSVG();
    case 'phrase': case 'review': return cover('lang', seedFor(c.id), undefined, 'lang');
    case 'skill': return cover('work', seedFor(c.id), 'Skill');
    case 'series': { const s = seriesById(c.series!.id); return `<div class="series-bg" style="--c1:${s?.colours[0] || '#5B4BFF'};--c2:${s?.colours[1] || '#19B6D9'}"><span class="series-n">${c.series!.n}</span></div>`; }
    default: return '';
  }
}

/* ---------- Card bodies ---------- */

const attrib = (src: string, url: string, licence = '') => `<p class="attrib">From <a href="${safeUrl(url)}" target="_blank" rel="noopener">${esc(src)}</a>${licence}</p>`;
const credit = (c: Card) => {
  const i = c.story?.image;
  if (i?.credit) return `<p class="credit">Photo: ${esc(i.credit)}</p>`;
  if (c.learn?.credit) return `<p class="credit">Image: ${esc(c.learn.credit)}</p>`;
  return '';
};

function body(c: Card): string {
  switch (c.kind) {
    case 'story': {
      const s = c.story!;
      const text = sentences(s.standfirst, 2);
      return `<div class="meta">${ICON.bolt}<span>${storyMeta(s)}</span></div>
        ${c.earlier ? '<span class="pill earlier">Earlier today</span>' : c.followed ? '<span class="pill">Following · new coverage</span>' : c.must ? `<span class="pill">${c.story?.via === 'Breaking' ? 'Breaking' : 'Top story today'}</span>` : ''}
        <h2>${hl(s.title, s.entities)}</h2>${text ? `<p>${hl(text, s.entities)}</p>` : ''}
        <button class="readbtn glass open">Read the full story ${ICON.chev}</button>
        <div class="dismiss"><button class="dz done-it" aria-label="Mark as read: don’t show this story again">${ICON.check}<span>Mark as read</span></button><button class="dz not-it" aria-label="Not interested: hide this story and choose what to see less of">${ICON.hide}<span>Not interested</span></button></div>${credit(c)}`;
    }
    case 'learn': {
      const l = c.learn!;
      const src = l.source === 'NASA' ? 'NASA' : l.kind === 'potd' ? 'Wikimedia Commons' : 'Wikipedia';
      const lic = src === 'Wikipedia' ? ' (CC BY-SA)' : '';
      if (l.kind === 'onthisday') return `<div class="meta"><span>${esc(c.label.toUpperCase())}</span></div><div class="big">${l.year}</div><h2 class="h-sm">${esc(l.event)}</h2>
        <button class="readbtn glass open">About ${esc(l.title)} ${ICON.chev}</button>${attrib('Wikipedia', l.url, lic)}`;
      const know = `<div class="dismiss"><button class="dz know-it" aria-label="I know this: skip it and go deeper">${ICON.check}<span>I know this</span></button></div>`;
      if (l.kind === 'fact') return `<div class="meta"><span>DID YOU KNOW? · WIKIPEDIA</span></div><h2 class="h-sm${(l.hook || '').length > 140 ? ' h-xs' : ''}">${esc(l.hook || l.title)}</h2>
        <button class="readbtn solid open">Learn the story ${ICON.chev}</button>${know}${attrib('Wikipedia', l.url, lic)}${credit(c)}`;
      if (l.kind === 'potd') return `<div class="meta"><span>${esc(c.label.toUpperCase())}</span></div><p class="lead">${esc(sentences(l.extract, 2))}</p>${attrib('Wikimedia Commons', l.url)}${credit(c)}`;
      return `<div class="meta"><span>${esc(c.label.toUpperCase())} · ${esc(src.toUpperCase())}</span></div><h2>${esc(l.title)}</h2>
        <p>${esc(l.fact || sentences(l.extract, 2))}</p><button class="readbtn ${l.kind === 'topic' ? 'solid' : 'glass'} open">${l.kind === 'topic' ? 'Start learning' : 'Read more'} ${ICON.chev}</button>${l.kind === 'topic' || l.kind === 'featured' ? know : ''}${attrib(src, l.url, lic)}${credit(c)}`;
    }
    case 'quiz': {
      const q = c.quiz!;
      return `<div class="meta"><span>QUIZ · FROM ${esc(q.source.name.toUpperCase())}</span></div><h2 class="h-sm">${esc(q.q)}</h2>${q.prompt ? `<p class="lead">${esc(q.prompt)}</p>` : ''}
        <div class="opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>
        <div class="explain"><p>${esc(q.explain)}</p>${q.article ? `<button class="readbtn glass open">About ${esc(q.article.title)} ${ICON.chev}</button>` : ''}${attrib(q.source.name, q.source.url)}</div>`;
    }
    case 'skill': return `<div class="meta"><span>SKILL OF THE DAY · YOUR WORK</span></div><h2>${esc(cap(c.skill!.label))}</h2>
        <p class="skill-desc"><span class="skel"></span><span class="skel short"></span></p><button class="readbtn solid open">Start learning ${ICON.chev}</button><p class="attrib">From ESCO, the EU's skills classification</p>`;
    case 'phrase': case 'review': {
      const { lang, id } = c.phrase!;
      const p = PACKS[lang]?.find(x => x.id === id);
      if (!p) return '';
      const unchecked = p.checked ? '' : '<span class="unchecked">Not yet checked</span>';
      const phraseBlock = `${unchecked}<h2 class="phrase" lang="${esc(LANG_CODE[lang] || '')}">${esc(p.phrase)}</h2>${p.romanisation ? `<p class="roman">${esc(p.romanisation)}</p>` : ''}<p class="say">Say it: <b>${esc(p.say)}</b></p>
        <div class="choices"><button class="choice hear">${ICON.speaker} Hear it</button><button class="choice slow">Slowly</button></div>`;
      if (c.kind === 'phrase') return `<div class="meta"><span>${esc(lang.toUpperCase())} · PHRASE OF THE DAY</span></div>${phraseBlock}<p class="lead"><b>${esc(p.meaning)}</b>. ${esc(p.when)}</p><button class="readbtn solid start-lesson">Start 5-minute lesson ${ICON.chev}</button><p class="progress-line">${esc(progressLine(lang))}</p>`;
      return `<div class="meta"><span>REMEMBER THIS? · ${esc(lang.toUpperCase())}</span></div><h2>${esc(p.meaning)}</h2><p class="lead">${esc(p.when)}</p>
        <button class="readbtn solid show-phrase">Show the phrase</button><div class="reveal">${phraseBlock}
        <div class="choices grade"><button class="choice yes got">Got it</button><button class="choice notyet">Not yet</button></div></div>`;
    }
    case 'series': {
      const s = seriesById(c.series!.id); const e = s?.episodes.find(x => x.n === c.series!.n);
      if (!s || !e) return '';
      const started = doneEpisodes(s.id).length > 0;
      return `<div class="meta"><span>SERIES · EPISODE ${e.n} OF ${s.episodes.length} · ${minutes(e)} MIN</span></div>${isDraft(s) ? '<span class="unchecked">Draft for review</span>' : s.kind === 'language' ? '<span class="unchecked">Not yet checked</span>' : ''}
        <h2>${esc(e.title)}</h2><p class="lead"><b>${esc(s.title)}</b>. ${esc(s.blurb)}</p>
        <button class="readbtn solid start-series">${started ? 'Continue the series' : 'Start episode'} ${ICON.chev}</button>`;
    }
    case 'sign': return `<div class="meta"><span>SIGN OF THE DAY · BSL</span></div><h2>The BSL vowels</h2><p>Thumb is <b>A</b>, then <b>E, I, O, U</b> across the fingertips. Watch the finger move.</p>`;
    case 'hub': {
      const h = c.hub!;
      return `<div class="meta"><span>${h.kind === 'changelog' ? 'HUBSPOT DEVELOPER CHANGELOG' : 'HUBSPOT BLOG'} · ${ago(h.published, true)}</span></div>
        ${h.kind === 'changelog' ? '<span class="pill">New in HubSpot: try it</span>' : ''}<h2>${esc(h.title)}</h2>${h.summary ? `<p>${esc(sentences(h.summary, 2))}</p>` : ''}
        <a class="readbtn glass" href="${safeUrl(h.url)}" target="_blank" rel="noopener">Read it on HubSpot ${ICON.chev}</a>`;
    }
    default: return '';
  }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);


/* ---------- Actions ---------- */

export function snapshot(c: Card): SavedItem | null {
  const base = { id: c.id, topic: c.topic, at: now().toISOString() };
  if (c.story) return { ...base, id: c.story.id, kind: 'story', title: c.story.title, story: c.story };
  if (c.learn) return { ...base, kind: 'learn', title: c.learn.title, learn: c.learn };
  if (c.quiz) return { ...base, kind: 'quiz', title: c.quiz.q, quiz: c.quiz };
  if (c.hub) return { ...base, kind: 'hub', title: c.hub.title, hub: c.hub };
  if (c.skill) return { ...base, id: `skill-${c.skill.id}`, kind: 'skill', title: c.skill.label, skill: c.skill };
  if (c.phrase) { const p = PACKS[c.phrase.lang]?.find(x => x.id === c.phrase!.id); if (p) return { ...base, id: `phrase-${c.phrase.lang}-${c.phrase.id}`, kind: 'phrase', title: p.phrase, topic: 'lang', phrase: c.phrase }; }
  return null;
}
const saveId = (c: Card) => c.story?.id || (c.skill ? `skill-${c.skill.id}` : c.phrase ? `phrase-${c.phrase.lang}-${c.phrase.id}` : c.id);
const likeId = saveId;

export function toggleSave(c: Card) {
  const id = saveId(c);
  if (isSaved(id)) { S.saved = S.saved.filter(x => x.id !== id); toast('Removed from Saved'); }
  else { const snap = snapshot(c); if (!snap) return; S.saved.unshift(snap); toast('Saved'); }
  persist.saved(); sync(id);
}

export function toggleLike(c: Card, el?: HTMLElement) {
  const id = likeId(c);
  const on = !S.liked.has(id);
  on ? S.liked.add(id) : S.liked.delete(id);
  persist.liked();
  // Likes teach the feed: the card's interests and topic get a little more weight
  const mine = new Set(S.profile?.interests.map(i => i.id) || []);
  (c.story?.tags || (c.learn?.interest ? [c.learn.interest] : [])).filter(t => mine.has(t)).forEach(t => nudge(t, on ? 1 : -1));
  nudge(c.topic, on ? 0.5 : -0.5);
  sync(id);
  document.querySelectorAll(`[data-like="${CSS.escape(id)}"]`).forEach(b => { b.classList.remove('pop'); void (b as HTMLElement).offsetWidth; b.classList.add('pop'); });
  if (on && el) pullUpSameTopic(c, el);
  // Likes also lead to suggestions: a topic or person from this card worth following
  if (on) { const sg = afterLike(c.story?.tags || (c.learn?.interest ? [c.learn.interest] : []), c.story?.entities); if (sg) setTimeout(() => offer(sg), 700); }
}

/* Liking a card pulls the next card on the same topic up the feed */
function pullUpSameTopic(c: Card, el: HTMLElement) {
  const feed = el.parentElement; if (!feed) return;
  const cards = [...feed.children] as HTMLElement[];
  const here = cards.indexOf(el);
  const next = cards.slice(here + 2).find(n => n.dataset.topic === c.topic && !n.dataset.seen && n.dataset.kind !== 'done');
  if (next) el.after(next);
}

export function sync(id: string) {
  document.querySelectorAll<HTMLElement>(`[data-like="${CSS.escape(id)}"]`).forEach(b => { const on = S.liked.has(id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  document.querySelectorAll<HTMLElement>(`[data-save="${CSS.escape(id)}"]`).forEach(b => { const on = isSaved(id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); const l = b.querySelector('span'); if (l) l.textContent = on ? 'Saved' : 'Save'; });
}

export function fewerLikeThis(c: Card) {
  nudge(c.topic, -1);
  (c.story?.tags || []).forEach(t => nudge(t, -1));
  toast('Got it. Fewer stories like this');
}

export function moreMenu(c: Card) {
  const title = c.story?.title || c.learn?.title || c.quiz?.q || c.hub?.title || c.skill?.label || c.label;
  const url = c.story?.url || c.learn?.url || c.hub?.url || c.quiz?.source.url;
  options([
    ...(url ? [['share', 'Share', () => share(title, url)] as [string, string, () => void]] : []),
    ...(c.kind === 'story' ? [
      ['done', 'Mark as read', () => markDone(c, cardEl(c))] as [string, string, () => void],
      ['not', 'Not interested…', () => notInterested(c, cardEl(c))] as [string, string, () => void],
    ] : []),
    ...(c.learn && ['topic', 'fact', 'featured'].includes(c.learn.kind) ? [['know', 'I know this', () => knowThis(c, cardEl(c))] as [string, string, () => void]] : []),
    ['wrong', 'Something wrong?', () => feedback(c.id, title)],
  ], 'Card options');
}

const cardEl = (c: Card) => document.querySelector<HTMLElement>(`#feed [data-id="${CSS.escape(c.id)}"]`) || undefined;

export async function share(title: string, url: string) {
  try {
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(`${title} ${url}`); toast('Link copied'); }
  } catch { /* cancelled */ }
}

/* ---------- Rendering ---------- */

export function render(c: Card): HTMLElement {
  // An article, not a section: a labelled section counts as a landmark, and every card would repeat the same one
  const el = document.createElement('article');
  el.className = `card k-${c.kind} t-${c.topic}`;
  el.dataset.id = c.id; el.dataset.kind = c.kind; el.dataset.topic = c.topic;
  el.setAttribute('aria-label', c.label);
  (el as any)._card = c;
  const id = likeId(c);
  const canSave = !!snapshot(c) && !['sign'].includes(c.kind);
  const rail = ['sign', 'catchup', 'done'].includes(c.kind) ? '' : `<div class="rail">
      <button class="rb glass" data-like="${esc(id)}" aria-label="Like" aria-pressed="${S.liked.has(id)}">${ICON.heart}</button>
      ${canSave ? `<button class="rb glass" data-save="${esc(saveId(c))}" aria-label="Save" aria-pressed="${isSaved(saveId(c))}">${ICON.mark}</button>` : ''}
      <button class="rb glass more" aria-label="More options">${ICON.more}</button></div>`;
  el.innerHTML = `${background(c)}<div class="shade"></div><div class="inner">${body(c)}</div>${rail}`;
  sync(id); el.querySelectorAll('[data-like]').forEach(b => b.classList.toggle('on', S.liked.has(id)));
  el.querySelectorAll('[data-save]').forEach(b => b.classList.toggle('on', isSaved(saveId(c))));
  fixImages(el);
  wire(c, el);
  return el;
}

function wire(c: Card, el: HTMLElement) {
  el.querySelector('[data-like]')?.addEventListener('click', e => { e.stopPropagation(); toggleLike(c, el); });
  el.querySelector('[data-save]')?.addEventListener('click', e => { e.stopPropagation(); toggleSave(c); });
  el.querySelector('.more')?.addEventListener('click', e => { e.stopPropagation(); moreMenu(c); });
  const open = () => {
    if (c.story) openStory(c.story);
    else if (c.learn) openLearn(c.learn);
    else if (c.quiz?.article) openLearn({ id: `qa-${c.quiz.id}`, kind: 'topic', topic: c.topic, title: c.quiz.article.title, extract: c.quiz.article.extract, image: c.quiz.article.image, url: c.quiz.article.url, source: 'Wikipedia' });
    else if (c.skill) openSkill(c.skill);
    else if (c.series) document.dispatchEvent(new CustomEvent('kf-series', { detail: c.series }));
  };
  el.querySelector('.open')?.addEventListener('click', e => { e.stopPropagation(); open(); });
  el.querySelector('.done-it')?.addEventListener('click', e => { e.stopPropagation(); markDone(c, el); });
  el.querySelector('.not-it')?.addEventListener('click', e => { e.stopPropagation(); notInterested(c, el); });
  el.querySelector('.know-it')?.addEventListener('click', e => { e.stopPropagation(); knowThis(c, el); });
  el.querySelector('.start-series')?.addEventListener('click', e => { e.stopPropagation(); open(); });
  // Taps: a double tap anywhere likes; a single tap on the words opens the story or learning page.
  // The single tap waits a moment, so a double tap never opens the story by accident.
  const canLike = !['sign', 'catchup', 'done'].includes(c.kind);
  const opens = ['story', 'learn', 'skill', 'series'].includes(c.kind) || (c.kind === 'quiz' && !!c.quiz?.article);
  let last = 0, pending: ReturnType<typeof setTimeout> | undefined;
  el.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target.closest('button,a,.opts,input')) return;
    const t = Date.now();
    if (canLike && t - last < 320) {
      clearTimeout(pending); last = 0;
      const b = el.getBoundingClientRect(); burst(el, e.clientX - b.left, e.clientY - b.top);
      if (!S.liked.has(likeId(c))) toggleLike(c, el);
      return;
    }
    last = t;
    if (opens && target.closest('.inner h2, .inner p, .inner .meta')) { clearTimeout(pending); pending = setTimeout(open, canLike ? 320 : 0); }
  });

  if (c.kind === 'quiz') {
    el.querySelectorAll<HTMLButtonElement>('.opt').forEach(o => o.addEventListener('click', e => {
      e.stopPropagation();
      if (el.dataset.answered) return; el.dataset.answered = '1';
      const k = +o.dataset.k!; const right = k === c.quiz!.answer;
      bump('quizDone'); if (right) bump('quizRight');
      el.querySelectorAll<HTMLButtonElement>('.opt').forEach(x => { const xk = +x.dataset.k!; if (xk === c.quiz!.answer) x.classList.add('right'); else if (xk === k) x.classList.add('wrong'); });
      el.querySelector('.explain')!.classList.add('show');
      // Wrong answers come back as reviews
      if (!right) srs.add(`quiz:${c.quiz!.id}`, 'quiz', { quiz: c.quiz });
      else bump('learned');
    }));
  }
  if (c.kind === 'phrase' || c.kind === 'review') {
    const { lang, id } = c.phrase!;
    const p = PACKS[lang]?.find(x => x.id === id);
    el.querySelectorAll('.hear').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (p) speakIn(p.phrase, lang, 0.9); }));
    el.querySelectorAll('.slow').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (p) speakIn(p.phrase, lang, 0.55); }));
    el.querySelector('.start-lesson')?.addEventListener('click', e => { e.stopPropagation(); document.dispatchEvent(new CustomEvent('kf-lesson', { detail: lang })); });
    el.querySelector('.show-phrase')?.addEventListener('click', e => { e.stopPropagation(); (e.currentTarget as HTMLElement).remove(); el.querySelector('.reveal')!.classList.add('show'); });
    const grade = (ok: boolean) => {
      srs.answer(c.review!, ok);
      if (ok) bump('learned');
      el.querySelector('.grade')!.outerHTML = `<p class="lead"><b>${ok ? 'Nice.' : 'No problem.'}</b> ${ok ? "It'll come back later to check it's stuck." : "It'll come back tomorrow."}</p><p class="progress-line">${esc(progressLine(lang))}</p>`;
    };
    el.querySelector('.got')?.addEventListener('click', e => { e.stopPropagation(); grade(true); });
    el.querySelector('.notyet')?.addEventListener('click', e => { e.stopPropagation(); grade(false); });
  }
  if (c.kind === 'skill') loadSkill(c.skill!.id).then(s => {
    const p = el.querySelector('.skill-desc'); if (!p) return;
    if (s?.description) p.textContent = sentences(s.description, 2);
    else p.textContent = "Couldn't load this skill's description just now.";
    if (s?.wiki?.image && !el.querySelector('img.photo')) { const t = document.createElement('div'); t.innerHTML = framed(s.wiki.image, c); el.querySelector('.cover')?.replaceWith(t.firstElementChild!); fixImages(el); }
  });
  if (c.kind === 'skill') srs.add(`skill:${c.skill!.id}`, 'skill', { skill: c.skill });

}

function burst(el: HTMLElement, x: number, y: number) {
  const h = document.createElement('div'); h.className = 'burst'; h.style.left = x + 'px'; h.style.top = y + 'px';
  h.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 20.5S3.5 15.6 3.5 9.3A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.5c0 6.3-8.5 11.2-8.5 11.2z"/></svg>';
  el.appendChild(h); setTimeout(() => h.remove(), 850);
}

/* ---------- Skill of the day: fetched once and kept on the phone ---------- */

export interface SkillInfo { id: string; label: string; description: string; url: string; wiki: { title: string; extract: string; image?: string; url: string; description?: string } | null }
const skillCache = new Map<string, Promise<SkillInfo | null>>();
export function loadSkill(id: string): Promise<SkillInfo | null> {
  if (!skillCache.has(id)) skillCache.set(id, (async () => {
    const key = `kf2-skill-${id}`;
    try { const c = localStorage.getItem(key); if (c) return JSON.parse(c); } catch { /* ignore */ }
    try {
      const r = await fetch(`/api/skill?id=${encodeURIComponent(id)}`);
      if (!r.ok) return null;
      const s = await r.json();
      try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* full */ }
      return s;
    } catch { return null; }
  })());
  return skillCache.get(id)!;
}

