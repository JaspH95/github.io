/* The story page (Particle-style) and the learning article view. One overlay with a small back stack,
   so "Related stories" and "Learn the background" can go deeper and the back button steps out again. */
import { S, persist, isSaved, isFollowing, markRead, bump, now, remember } from './state';
import { esc, safeUrl, ago, age, toast, options, ICON, outletBadge, $, plural } from './ui';
import { notInterested } from './dismiss';
import { hl, photo, fixImages, storyMeta, toggleSave, toggleLike, sync, fewerLikeThis, share, loadSkill, type Card, yearText, listOf } from './cards';
import { findStory, allStories, storyLabel, interestById } from './data';
import { playQueue, stopAudio, isPlaying } from './audio';
import { feedback } from './feedback';
import type { Story, LearnCard, Entity } from './types';

const story = () => document.getElementById('story')!;
const dock = () => document.getElementById('dock')!;
type View = { kind: 'story'; s: Story } | { kind: 'learn'; l: LearnCard } | { kind: 'skill'; id: string; label: string } | { kind: 'wiki'; title: string };
let stack: View[] = [];
let current: { card: Card; speech: string[]; title: string; url?: string } | null = null;

/* ---------- Wikipedia, fetched live on the phone ---------- */
export interface Wiki { title: string; description?: string; extract: string; intro?: string; image?: string; url: string }
const wikiCache = new Map<string, Promise<Wiki | null>>();
export function wiki(title: string): Promise<Wiki | null> {
  if (!wikiCache.has(title)) wikiCache.set(title, (async () => {
    try {
      const t = encodeURIComponent(title.replace(/ /g, '_'));
      const [sum, intro] = await Promise.all([
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}?redirect=true`).then(r => (r.ok ? r.json() : null)),
        fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&origin=*&titles=${t}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!sum?.extract) return null;
      return {
        title: sum.titles?.normalized || sum.title, description: sum.description, extract: sum.extract,
        intro: intro?.query?.pages?.[0]?.extract || undefined,
        image: sum.originalimage?.width <= 1600 ? sum.originalimage.source : sum.thumbnail?.source?.replace(/\/\d+px-/, '/1080px-'),
        url: sum.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${t}`,
      };
    } catch { return null; }
  })());
  return wikiCache.get(title)!;
}

/* ---------- Opening and closing ---------- */

export function openStory(s: Story) { push({ kind: 'story', s }); }
export function openLearn(l: LearnCard) { push({ kind: 'learn', l }); }
export function openSkill(k: { id: string; label: string }) { push({ kind: 'skill', id: k.id, label: k.label }); }
export function openWiki(title: string) { push({ kind: 'wiki', title }); }
export const isOpen = () => story().classList.contains('open');

function push(v: View) { stack.push(v); show(v); }
export function back() {
  stack.pop();
  const prev = stack[stack.length - 1];
  if (prev) show(prev); else close();
}
export function close() {
  stack = []; current = null; stopAudio();
  const el = story();
  el.style.transition = ''; el.style.transform = '';
  el.classList.remove('open');
  document.body.classList.remove('story-open');
  window.dispatchEvent(new CustomEvent('kf:story-closed'));
}

function show(v: View) {
  stopAudio();
  document.title = `${v.kind === 'story' ? v.s.title : v.kind === 'learn' ? v.l.title : v.kind === 'skill' ? v.label : v.title} · Knowfeed`;
  const el = story();
  if (v.kind === 'story') storyView(v.s);
  else if (v.kind === 'learn') learnView(v.l);
  else if (v.kind === 'skill') skillView(v.id, v.label);
  else wikiView(v.title);
  el.scrollTop = 0;
  requestAnimationFrame(() => { el.classList.add('open'); document.body.classList.add('story-open'); });
}

/* ---------- The story page ---------- */

type Tab = 'overview' | 'fivew' | 'timeline';

function panelHTML(s: Story, tab: Tab): string {
  const sum = s.summary;
  if (tab === 'fivew' && sum?.fivew) return `<dl class="w5">${sum.fivew.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${hl(v, s.entities)}</dd>`).join('')}</dl>`;
  if (tab === 'timeline' && s.timeline) return `<ul class="tl">${[...s.timeline].reverse().map(t => `<li><span class="when">${esc(when(t.at))}${t.outlet ? ` · ${esc(t.outlet)}` : ''}</span>${t.url ? `<a href="${safeUrl(t.url)}" target="_blank" rel="noopener">${esc(t.text)}</a>` : esc(t.text)}</li>`).join('')}</ul>`;
  if (!sum) return `<p class="plain">${esc(s.standfirst || s.title)}</p><p class="panel-note">${s.id.startsWith('live-')
    ? `The headline and summary are from ${esc(s.outlet)}.${s.paywall ? ' The full article may need a subscription.' : ''} <a href="${safeUrl(s.url)}" target="_blank" rel="noopener">Read it on ${esc(s.outlet)}</a>.`
    : `From ${esc(s.outlet)}. A summary appears here once the story has been read in full.`}</p>`;
  return `<ul class="gist">${sum.gist.map(g => `<li>${hl(g, s.entities)}</li>`).join('')}</ul>
    ${sum.sections.map(x => `<h2 class="ph">${esc(x.heading)}</h2><p>${hl(x.text, s.entities)}</p>`).join('')}`;
}
const when = (iso: string) => {
  const d = new Date(iso), n = now();
  const sameDay = d.toDateString() === n.toDateString();
  return sameDay ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function related(s: Story): Story[] {
  const names = new Set((s.entities || []).map(e => e.name.toLowerCase()));
  const tags = new Set(s.tags);
  const seen = new Set<string>([s.id]);
  return allStories()
    .filter(o => !seen.has(o.id) && (seen.add(o.id), true))
    .map(o => ({ o, sc: (o.entities || []).filter(e => names.has(e.name.toLowerCase())).length * 2 + o.tags.filter(t => tags.has(t)).length + (o.topic === s.topic ? 0.5 : 0) + o.importance }))
    .filter(x => x.sc >= 1.5)
    .sort((a, b) => b.sc - a.sc).slice(0, 6).map(x => x.o);
}

function storyView(given: Story) {
  const s = findStory(given.id) || given;       // the latest version, which may now have a summary
  const card: Card = { id: s.id, kind: 'story', topic: s.topic, label: storyLabel(s), story: s };
  if (markRead(s.id)) bump('read');
  remember(s, 'read');
  // Following a story: you've now seen its coverage
  const f = S.follows.find(x => x.id === s.id); if (f) { f.seenCount = s.articles.length; f.urls = [...new Set([...f.urls, ...s.articles.map(a => a.url)])]; persist.follows(); }
  const sum = s.summary;
  const tabs: [Tab, string][] = [['overview', 'Overview'], ...(sum?.fivew ? [['fivew', 'The 5 Ws'] as [Tab, string]] : []), ...(s.timeline && s.timeline.length > 1 ? [['timeline', 'Timeline'] as [Tab, string]] : [])];
  const outlets = new Set(s.articles.map(a => a.outlet)).size;
  const ents = (s.entities || []).filter(e => e.wiki);
  const bg = ents[0];
  const rel = related(s);
  const developing = s.timeline && s.timeline.length > 1 && +new Date(s.updated) - +new Date(s.first) > 3600_000;
  const el = story();
  el.dataset.kind = 'story';
  el.innerHTML = `
    <div class="hero"${s.image?.w && s.image.h ? ` style="--ar:${Math.max(1.2, Math.min(2, s.image.w / s.image.h)).toFixed(3)}"` : ''}>${photo(s.image?.url, { ...card, label: card.label }, s.image, 'scene')}${s.image?.credit ? `<span class="hero-credit">${esc(s.image.source === 'article' ? 'Photo: ' : '')}${esc(s.image.credit)}</span>` : ''}</div>
    <div class="sbody">
      <div class="meta">${ICON.bolt}<span>${esc(card.label.toUpperCase())} · ${ago(s.first, true)}${developing ? ` · UPDATED ${ago(s.updated, true)}` : ''}</span></div>
      <h1>${hl(s.title, s.entities)}</h1>
      ${s.standfirst ? `<p class="sub">${hl(s.standfirst, s.entities)}</p>` : ''}
      ${tabs.length > 1 ? `<div class="stabs" role="tablist">${tabs.map(([k, l], i) => `<button class="stab ${i ? '' : 'on'}" data-t="${k}" role="tab" aria-selected="${!i}">${l}</button>`).join('')}</div>` : '<div class="stabs-gap"></div>'}
      <div class="panel" id="panel" role="tabpanel">${panelHTML(s, 'overview')}</div>
      ${sum ? `<p class="ai-label">Summary by AI from ${plural(sum.n, 'article')} · ${esc(sum.model)}</p>` : ''}

      <section class="sec"><div class="sech"><h2>${plural(s.articles.length, 'Article')} ${ICON.chev}</h2><button class="collapse" aria-label="Collapse">–</button></div>
        <div class="secbody hscroll">${s.articles.map(a => { const b = outletBadge(a.outlet); return `<a class="acard" href="${safeUrl(a.url)}" target="_blank" rel="noopener"><div class="arow"><span class="logo" style="background:${b.col};color:${b.ink}">${esc(b.ini)}</span><span class="outlet">${esc(a.outlet)}</span><span class="age">${age(a.published)}</span></div><div class="ahead">${esc(a.title)}</div></a>`; }).join('')}</div></section>

      ${sum?.quotes?.length ? `<section class="sec"><div class="sech"><h2>Quotes ${ICON.chev}</h2><button class="collapse" aria-label="Collapse">–</button></div><div class="secbody">${sum.quotes.map(q => { const b = outletBadge(q.who); return `<div class="qwho"><span class="logo" style="background:${b.col}">${esc(b.ini)}</span><span><b>${esc(q.who)}</b>${q.role ? `<span>${esc(q.role)}</span>` : ''}</span></div><div class="qcard"><blockquote>“${esc(q.text)}”</blockquote><span class="chip">From the articles above</span></div>`; }).join('')}</div></section>` : ''}

      ${ents.length ? `<section class="sec"><div class="sech"><h2>People, Places &amp; Things ${ICON.chev}</h2></div>
        <p class="follow-intro"><span class="plus">+ Follow</span> <b>People, Places, or Things</b> to get more news you care about</p>
        ${ents.map(e => entityRow(e)).join('')}</section>` : ''}

      ${bg ? `<section class="sec"><div class="sech"><h2>Learn the background</h2></div>
        <button class="learn" data-wiki="${esc(bg.wiki!)}"><span class="ic">${ICON.book}</span><span><b>${esc(bg.wiki!)}</b><span>New to this? Learn the basics in 2 minutes</span></span></button></section>` : ''}

      ${rel.length ? `<section class="sec"><div class="sech"><h2>Related Stories</h2></div>
        <div class="hscroll">${rel.map(o => `<button class="rcard" data-id="${esc(o.id)}">${photo(o.image?.url, { topic: o.topic, id: o.id, label: storyLabel(o) }, o.image)}<div class="shade"></div><div class="meta">${ICON.bolt}<span>${storyMeta(o)}</span></div><h3>${hl(o.title, o.entities)}</h3><p>${esc(o.standfirst)}</p></button>`).join('')}</div></section>` : ''}

      <p class="fine">${sum ? `Summary written by AI only from the ${plural(sum.n, 'article')} it could read in full, and checked against their text.` : `From ${esc(s.outlet)}${outlets > 1 ? ` and ${plural(outlets - 1, 'other outlet')}` : ''}.`} Tap any article to read the original. <button class="linkish report">Something wrong?</button></p>
    </div>`;
  fixImages(el);
  const speech = [s.title, ...(sum ? [...sum.gist, ...sum.sections.map(x => `${x.heading}. ${x.text}`)] : [s.standfirst])].filter(Boolean);
  current = { card, speech, title: s.title, url: s.url };
  el.querySelectorAll<HTMLButtonElement>('.stab').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('.stab').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    $('#panel', el).innerHTML = panelHTML(s, b.dataset.t as Tab);
  }));
  el.querySelectorAll<HTMLButtonElement>('.collapse').forEach(b => b.addEventListener('click', () => { const sec = b.closest('.sec')!; sec.classList.toggle('closed'); b.textContent = sec.classList.contains('closed') ? '+' : '–'; b.setAttribute('aria-label', sec.classList.contains('closed') ? 'Expand' : 'Collapse'); }));
  wireEntities(el);
  el.querySelector<HTMLElement>('.learn')?.addEventListener('click', e => openWiki((e.currentTarget as HTMLElement).dataset.wiki!));
  el.querySelectorAll<HTMLElement>('.rcard').forEach(b => b.addEventListener('click', () => { const o = rel.find(x => x.id === b.dataset.id); if (o) openStory(o); }));
  el.querySelector('.report')?.addEventListener('click', () => feedback(s.id, s.title));
  setDock(card, true);
}

function entityRow(e: Entity): string {
  const k = e.name.toLowerCase();
  const on = S.entities.has(k);
  const b = outletBadge(e.name);
  const pic = e.image ? `<img class="logo pic" src="${safeUrl(e.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="logo" style="background:${b.col}">${esc(b.ini)}</span>`;
  return `<div class="erow" data-wiki="${esc(e.wiki || '')}">${pic}<span class="tx"><b>${esc(e.name)}</b><span>${esc(e.desc || e.wiki || '')}</span></span><button class="fbtn ${on ? 'on' : ''}" data-n="${esc(e.name)}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(e.name)}" aria-pressed="${on}">${on ? ICON.check : '+'}</button></div>`;
}
function wireEntities(el: HTMLElement) {
  el.querySelectorAll<HTMLButtonElement>('.fbtn').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = b.dataset.n!, k = n.toLowerCase();
    S.entities.has(k) ? S.entities.delete(k) : S.entities.add(k);
    persist.entities();
    const on = S.entities.has(k);
    b.classList.toggle('on', on); b.innerHTML = on ? ICON.check : '+'; b.setAttribute('aria-pressed', String(on));
    toast(on ? `Following ${n}` : `Unfollowed ${n}`);
  }));
  el.querySelectorAll<HTMLElement>('.erow').forEach(r => r.addEventListener('click', () => { if (r.dataset.wiki) wikiSheet(r.dataset.wiki); }));
}

/* People and places open a short Wikipedia sheet */
async function wikiSheet(title: string) {
  const { openSheet } = await import('./ui');
  const s = openSheet(`<div class="wsheet"><div class="skel"></div><div class="skel"></div><div class="skel short"></div></div>`, title);
  const w = await wiki(title);
  if (!s.classList.contains('open')) return;
  s.querySelector('.wsheet')!.innerHTML = w ? `${w.image ? `<img src="${safeUrl(w.image)}" alt="" referrerpolicy="no-referrer">` : ''}<h3>${esc(w.title)}</h3>${w.description ? `<p class="wdesc">${esc(w.description)}</p>` : ''}<p>${esc(w.extract)}</p>
    <div class="wacts"><button class="cta more-w">Read more</button><a class="cta ghost" href="${safeUrl(w.url)}" target="_blank" rel="noopener">Wikipedia</a></div><p class="attrib-s">From Wikipedia (CC BY-SA)</p>`
    : `<p>Couldn't reach Wikipedia just now.</p>`;
  s.querySelector('.more-w')?.addEventListener('click', async () => { (await import('./ui')).closeSheet(); openWiki(title); });
}

/* ---------- Learning article view ---------- */

function articleShell(o: { id: string; topic: Card['topic']; label: string; title: string; sub?: string; image?: string; credit?: string; paras: string[]; source: string; url: string; licence?: string; extra?: string }) {
  const el = story();
  el.dataset.kind = 'learn';
  el.innerHTML = `
    <div class="hero">${photo(o.image, { topic: o.topic, id: o.id, label: o.label }, undefined, 'scene')}${o.credit ? `<span class="hero-credit">${esc(o.credit)}</span>` : ''}</div>
    <div class="sbody">
      <div class="meta"><span>${esc(o.label.toUpperCase())} · ${esc(o.source.toUpperCase())}</span></div>
      <h1>${esc(o.title)}</h1>${o.sub ? `<p class="sub">${esc(o.sub)}</p>` : ''}
      <div class="stabs-gap"></div>
      <div class="panel prose" id="panel">${o.paras.map(p => `<p>${esc(p)}</p>`).join('')}</div>
      ${o.extra || ''}
      <a class="cta full" href="${safeUrl(o.url)}" target="_blank" rel="noopener">Read it on ${esc(o.source)}</a>
      <p class="fine">From <a href="${safeUrl(o.url)}" target="_blank" rel="noopener">${esc(o.source)}</a>${o.licence || ''}. <button class="linkish report">Something wrong?</button></p>
    </div>`;
  fixImages(el);
  el.querySelector('.report')?.addEventListener('click', () => feedback(o.id, o.title));
}
const paras = (s: string) => s.split(/\n+/).map(x => x.trim()).filter(Boolean);

function learnView(l: LearnCard) {
  const label = l.kind === 'fact' ? 'Did you know?' : l.kind === 'invention' ? 'Cool invention' : l.kind === 'oddity' ? 'Fun fact' : l.kind === 'topic' ? ((l.interest && interestById.get(l.interest)?.label) || 'Learning') : l.kind === 'apod' ? 'NASA picture of the day' : l.kind === 'potd' ? 'Picture of the day' : l.kind === 'onthisday' ? 'On this day' : l.kind === 'featured' ? 'Featured article' : 'Most read today';
  const card: Card = { id: l.id, kind: 'learn', topic: l.topic, label, learn: l };
  const src = l.source === 'NASA' ? 'NASA' : l.kind === 'potd' ? 'Wikimedia Commons' : 'Wikipedia';
  const lic = src === 'Wikipedia' ? ' (CC BY-SA)' : '';
  const event = l.kind === 'onthisday' ? `<div class="otd"><b>${l.year}</b><span>${esc(l.event)}</span></div>` : '';
  articleShell({ id: l.id, topic: l.topic, label, title: l.title, sub: l.description, image: l.image, credit: l.credit ? `Image: ${l.credit}` : undefined, paras: paras(l.extract), source: src, url: l.url, licence: lic });
  if (event) story().querySelector('.panel')!.insertAdjacentHTML('beforebegin', event);
  if (l.kind === 'invention') story().querySelector('.panel')!.insertAdjacentHTML('beforebegin', `<div class="otd"><b>${esc(yearText(l.year))}</b><span>${l.by?.length ? `Invented by ${esc(listOf(l.by))}. ` : ''}Year and inventor from Wikidata.</span></div>`);
  else if (l.hook && l.kind === 'fact') story().querySelector('.panel')!.insertAdjacentHTML('beforebegin', `<p class="dyk-hook"><b>Did you know</b> ${esc(l.hook.replace(/^…/, ''))}</p>`);
  current = { card, speech: [l.title, l.extract], title: l.title, url: l.url };
  setDock(card, false);
  if (markRead(l.id)) bump('learned');
  // A fuller explainer: Wikipedia's whole introduction, fetched live
  if (src === 'Wikipedia' && l.kind !== 'potd') {
    const t = decodeURIComponent(l.url.split('/wiki/')[1] || '').replace(/_/g, ' ') || l.title;
    wiki(t).then(w => { if (w?.intro && w.intro.length > l.extract.length && current?.card.id === l.id) { story().querySelector('#panel')!.innerHTML = paras(w.intro).map(p => `<p>${esc(p)}</p>`).join(''); current.speech = [l.title, w.intro]; } });
  }
}

async function skillView(id: string, label: string) {
  const card: Card = { id: `skill-${id}`, kind: 'skill', topic: 'work', label: 'Skill of the day', skill: { id, label } };
  articleShell({ id: card.id, topic: 'work', label: 'Skill', title: cap(label), paras: ['Loading…'], source: 'ESCO', url: `https://esco.ec.europa.eu/en/classification/skill?uri=${encodeURIComponent('http://data.europa.eu/esco/skill/' + id)}` });
  current = { card, speech: [label], title: label };
  setDock(card, false);
  const s = await loadSkill(id);
  if (current?.card.id !== card.id) return;
  const el = story();
  if (!s) { el.querySelector('#panel')!.innerHTML = "<p>Couldn't load this skill just now. Check your connection and try again.</p>"; return; }
  el.querySelector('#panel')!.innerHTML = `<h2 class="ph">What it means</h2><p>${esc(s.description)}</p><p class="panel-note">The official description from ESCO, the EU's classification of skills and occupations.</p>`;
  if (s.wiki) {
    el.querySelector('#panel')!.insertAdjacentHTML('afterend', `<section class="sec"><div class="sech"><h2>The background</h2></div><div class="panel prose">${paras(s.wiki.extract).map(p => `<p>${esc(p)}</p>`).join('')}<p class="panel-note">From <a href="${safeUrl(s.wiki.url)}" target="_blank" rel="noopener">Wikipedia: ${esc(s.wiki.title)}</a> (CC BY-SA)</p></div></section>`);
    if (s.wiki.image) { const h = el.querySelector('.hero')!; h.innerHTML = photo(s.wiki.image, card); fixImages(h as HTMLElement); }
  }
  current.speech = [label, s.description, s.wiki?.extract || ''];
  if (markRead(card.id)) bump('learned');
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function wikiView(title: string) {
  const id = `wiki-${title}`;
  const card: Card = { id, kind: 'learn', topic: 'general', label: 'Background' };
  articleShell({ id, topic: 'general', label: 'Background', title, paras: ['Loading…'], source: 'Wikipedia', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, licence: ' (CC BY-SA)' });
  current = { card, speech: [title], title };
  setDock(card, false);
  const w = await wiki(title);
  if (current?.card.id !== id) return;
  if (!w) { story().querySelector('#panel')!.innerHTML = "<p>Couldn't reach Wikipedia just now. Check your connection and try again.</p>"; return; }
  const l: LearnCard = { id, kind: 'topic', topic: 'general', title: w.title, description: w.description, extract: w.intro || w.extract, image: w.image, url: w.url, source: 'Wikipedia' };
  learnView(l);
  stack[stack.length - 1] = { kind: 'learn', l };
}

/* ---------- The floating dock and header ---------- */

function setDock(card: Card, isStory: boolean) {
  const d = dock();
  const sid = card.story?.id || (card.skill ? `skill-${card.skill.id}` : card.id);
  d.innerHTML = `${isStory ? `<button id="dFollow" aria-pressed="${isFollowing(card.id)}">${ICON.plus}<span>${isFollowing(card.id) ? 'Following' : 'Follow story'}</span></button>` : ''}
    <button id="dSave" data-save="${esc(sid)}" aria-pressed="${isSaved(sid)}">${ICON.mark}<span>${isSaved(sid) ? 'Saved' : 'Save'}</span></button>
    <button id="dLike" class="icon-only" data-like="${esc(sid)}" aria-label="Like" aria-pressed="${S.liked.has(sid)}">${ICON.heart}</button>`;
  sync(sid);
  d.querySelector('#dFollow')?.classList.toggle('on', isFollowing(card.id));
  d.querySelector('#dFollow')?.addEventListener('click', () => toggleFollow(card));
  d.querySelector('#dSave')!.addEventListener('click', () => toggleSave(card));
  d.querySelector('#dLike')!.addEventListener('click', () => toggleLike(card));
}

function toggleFollow(card: Card) {
  const s = card.story!; if (!s) return;
  if (isFollowing(s.id)) { S.follows = S.follows.filter(f => f.id !== s.id); toast('Stopped following'); }
  else { S.follows.push({ id: s.id, title: s.title, urls: s.articles.map(a => a.url), names: (s.entities || []).map(e => e.name), at: now().toISOString(), seenCount: s.articles.length }); toast("Following. You'll get updates when this story changes"); }
  persist.follows();
  const b = document.getElementById('dFollow')!;
  b.classList.toggle('on', isFollowing(s.id)); b.setAttribute('aria-pressed', String(isFollowing(s.id)));
  b.querySelector('span')!.textContent = isFollowing(s.id) ? 'Following' : 'Follow story';
}

export function initStory() {
  document.getElementById('sBack')!.addEventListener('click', back);
  document.getElementById('sPlay')!.addEventListener('click', () => {
    if (!current) return;
    if (isPlaying()) { stopAudio(); return; }
    playQueue(current.speech.map(t => ({ text: t, label: current!.title })));
  });
  document.getElementById('sShare')!.addEventListener('click', () => { if (current) share(current.title, current.url || location.origin); });
  document.getElementById('sMore')!.addEventListener('click', () => {
    if (!current) return;
    const c = current.card;
    options([
      ['report', 'Report a problem with this', () => feedback(c.id, current?.title)],
      ...(c.kind === 'story' ? [['less', 'Show fewer stories like this', () => fewerLikeThis(c)] as [string, string, () => void], ['not', 'Not interested…', () => notInterested(c)] as [string, string, () => void]] : []),
      ['sources', "About Knowfeed's sources", () => toast('Summaries are written only from the linked articles')],
    ], 'Story options');
  });

  /* Swipe right or pull down from the top to go back */
  const el = story();
  let g: { x: number; y: number; top: boolean; mode: null | 'x' | 'y' | 'none'; d: number } | null = null;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; g = { x: t.clientX, y: t.clientY, top: el.scrollTop <= 0, mode: null, d: 0 }; }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (!g) return; const t = e.touches[0]; const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2 && dx > 0 && !(e.target as HTMLElement).closest('.hscroll,.stabs')) g.mode = 'x';
      else if (g.top && dy > 12 && Math.abs(dy) > Math.abs(dx)) g.mode = 'y';
      else if (Math.abs(dy) > 12 || Math.abs(dx) > 12) g.mode = 'none';
    }
    if (g.mode === 'x') { g.d = Math.max(0, dx); el.style.transition = 'none'; el.style.transform = `translateX(${g.d}px)`; }
    if (g.mode === 'y') { g.d = Math.max(0, dy) * 0.6; el.style.transition = 'none'; el.style.transform = `translateY(${g.d}px) scale(${1 - g.d / 2000})`; }
  }, { passive: true });
  el.addEventListener('touchend', () => {
    if (g && (g.mode === 'x' || g.mode === 'y')) {
      el.style.transition = '';
      el.style.transform = '';
      if (g.d > 90) back();
    }
    g = null;
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) back(); });
}
