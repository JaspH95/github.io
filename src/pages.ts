/* The tab pages: Learn, Languages, Saved and Search. These follow the phone's light or dark setting. */
import { S, persist } from './state';
import { esc, ago, ICON, plural, toast, openSheet, sentences } from './ui';
import { data, allStories, storyLabel, interestById, TOPIC_LABEL } from './data';
import { openStory, openLearn, openSkill, openWiki, wiki } from './story';
import { learnCard } from './edition';
import { PACKS, LANG_CODE, LANG_WIKI, BSL, hasPack, progressLine, phraseOfDay } from './languages';
import * as srs from './srs';
import { speakIn } from './audio';
import { startLesson, startReview } from './lessons';
import { openChat } from './chat';
import { onTab, go } from './nav';
import { signSVG } from './scenes';
import { photo, fixImages, render, type Card } from './cards';
import type { LearnCard, Story } from './types';

const thumb = (url: string | undefined, c: { topic: Card['topic']; id: string; label?: string }) => `<span class="thumb">${photo(url, c, undefined, 'th')}</span>`;
const head = (title: string, sub = '') => `<header class="phead"><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</header>`;

function learnRow(l: LearnCard, label?: string) {
  return `<button class="row" data-learn="${esc(l.id)}">${thumb(l.image, { topic: l.topic, id: l.id, label })}<span class="rt"><span class="rk">${esc((label || l.description || TOPIC_LABEL[l.topic]).toUpperCase())}</span><b>${esc(l.title)}</b><span class="rs">${esc(sentences(l.extract, 1))}</span></span></button>`;
}
function storyRow(s: Story) {
  return `<button class="row" data-story="${esc(s.id)}">${thumb(s.image?.url, { topic: s.topic, id: s.id, label: storyLabel(s) })}<span class="rt"><span class="rk">${esc(storyLabel(s).toUpperCase())} · ${esc(ago(s.updated))}</span><b>${esc(s.title)}</b></span></button>`;
}
function wireRows(el: HTMLElement, learn: LearnCard[] = [], stories: Story[] = []) {
  el.querySelectorAll<HTMLElement>('[data-learn]').forEach(b => b.addEventListener('click', () => { const l = learn.find(x => x.id === b.dataset.learn); if (l) openLearn(l); }));
  el.querySelectorAll<HTMLElement>('[data-story]').forEach(b => b.addEventListener('click', () => { const s = stories.find(x => x.id === b.dataset.story); if (s) openStory(s); }));
  fixImages(el);
}

/* ---------- Learn ---------- */

function learnPage(el: HTMLElement) {
  const p = S.profile!;
  const cards = data.learn?.cards || [];
  const learnIds = p.interests.filter(i => i.mode !== 'news').map(i => i.id);
  const due = srs.due({ mark: false, perLang: 99 }).length;
  const skills = p.skills;
  const todays = skills.length ? skills[Math.floor(Date.now() / 86400_000) % skills.length] : null;
  const byInterest = learnIds.map(id => ({ id, label: interestById.get(id)?.label || p.interests.find(i => i.id === id)?.label || id, cards: cards.filter(c => c.interest === id) })).filter(g => g.cards.length);
  const daily = cards.filter(c => c.kind !== 'topic');
  const searched = p.interests.filter(i => i.id.startsWith('q:') && i.mode !== 'news' && i.wiki);
  const quiz = (data.learn?.quizzes || [])[0];
  el.innerHTML = `${head('Learn', 'Your work, your interests and today\'s picks. Every session ends; start another when you like.')}
    ${todays ? `<section class="psec"><h2>Skill of the day</h2><button class="feature" data-skill="${esc(todays.id)}"><span class="ic">${ICON.book}</span><span><b>${esc(cap(todays.label))}</b><span>From your work${p.job ? `: ${esc(p.job.title)}` : ''}</span></span>${ICON.chev}</button>
      <div class="chips">${skills.map(k => `<button class="chip-btn" data-skill="${esc(k.id)}">${esc(cap(k.label))}</button>`).join('')}<button class="chip-btn add" data-add="skills">${ICON.plus} Skills</button></div></section>`
      : `<section class="psec"><h2>Your work</h2><button class="feature" data-add="skills"><span class="ic">${ICON.book}</span><span><b>Add your job and skills</b><span>Get a skill of the day and industry news</span></span>${ICON.chev}</button></section>`}
    <section class="psec"><h2>Review</h2><button class="feature" data-review="1" ${due ? '' : 'disabled'}><span class="ic">${ICON.check}</span><span><b>${due ? `${plural(Math.min(due, 5), 'thing')} to review` : 'Nothing due right now'}</b><span>${due ? 'Five minutes of quick recall' : 'Things you learn come back after 1, 3, 7, 14 and 30 days'}</span></span>${due ? ICON.chev : ''}</button></section>
    ${quiz ? `<section class="psec"><h2>Quiz of the day</h2><div class="mini-card" id="quizSlot"></div></section>` : ''}
    ${byInterest.map(g => `<section class="psec"><h2>${esc(g.label)}</h2><div class="rows">${g.cards.map(c => learnRow(c, g.label)).join('')}</div><button class="linkish books" data-books="${esc(g.label)}">Books about ${esc(g.label.toLowerCase())}</button></section>`).join('')}
    ${searched.map(i => `<section class="psec"><h2>${esc(i.label)}</h2><button class="feature" data-wiki="${esc(i.wiki!)}"><span class="ic">${ICON.book}</span><span><b>${esc(i.wiki!)}</b><span>From Wikipedia</span></span>${ICON.chev}</button></section>`).join('')}
    ${daily.length ? `<section class="psec"><h2>From Wikipedia and NASA today</h2><div class="rows">${daily.map(c => learnRow(c, learnCard(c).label)).join('')}</div></section>` : ''}
    ${!byInterest.length ? `<section class="psec"><button class="feature" data-add="interests"><span class="ic">${ICON.plus}</span><span><b>Choose what to learn about</b><span>Pick interests for learning, news or both</span></span>${ICON.chev}</button></section>` : ''}
    <p class="pfoot">Learning cards use Wikipedia (CC BY-SA), NASA and ESCO. The words are theirs, not AI's.</p>`;
  wireRows(el, cards);
  el.querySelectorAll<HTMLElement>('[data-skill]').forEach(b => b.addEventListener('click', () => { const k = skills.find(x => x.id === b.dataset.skill); if (k) openSkill(k); }));
  el.querySelector('[data-review]')?.addEventListener('click', () => startReview());
  el.querySelectorAll<HTMLElement>('[data-add]').forEach(b => b.addEventListener('click', () => openChat(b.dataset.add as any)));
  el.querySelectorAll<HTMLElement>('[data-wiki]').forEach(b => b.addEventListener('click', () => openWiki(b.dataset.wiki!)));
  el.querySelectorAll<HTMLElement>('[data-books]').forEach(b => b.addEventListener('click', () => books(b.dataset.books!)));
  const slot = el.querySelector<HTMLElement>('#quizSlot');
  if (slot && quiz) { const n = render({ id: quiz.id, kind: 'quiz', topic: quiz.topic, label: 'Quiz', quiz }); n.classList.add('inline'); slot.appendChild(n); }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* Book recommendations from Open Library: cover, description and where to find them. Never summarised. */
async function books(subject: string) {
  const s = openSheet(`<div class="books-list"><h3>Books about ${esc(subject.toLowerCase())}</h3><div class="skel"></div><div class="skel"></div></div>`, 'Books');
  try {
    const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(`subject:"${subject.toLowerCase()}"`)}&sort=rating&limit=8&fields=key,title,author_name,first_publish_year,cover_i`);
    const d = await r.json();
    const list = (d.docs || []).filter((b: any) => b.cover_i && b.title);
    s.querySelector('.books-list')!.innerHTML = `<h3>Books about ${esc(subject.toLowerCase())}</h3>${list.length ? list.map((b: any) => `<a class="book" href="https://openlibrary.org${esc(b.key)}" target="_blank" rel="noopener"><img src="https://covers.openlibrary.org/b/id/${+b.cover_i}-M.jpg" alt="" loading="lazy"><span><b>${esc(b.title)}</b><span>${esc((b.author_name || []).slice(0, 2).join(', '))}${b.first_publish_year ? ` · ${b.first_publish_year}` : ''}</span></span></a>`).join('') : '<p>No recommendations found for this one.</p>'}<p class="attrib-s">Recommendations from Open Library</p>`;
  } catch { s.querySelector('.books-list')!.innerHTML = `<p>Couldn't reach Open Library just now.</p>`; }
}

/* ---------- Languages ---------- */

function langsPage(el: HTMLElement) {
  const p = S.profile!;
  const langs = p.languages;
  if (!langs.length) {
    el.innerHTML = `${head('Languages', 'A phrase a day, a 5-minute lesson when you want one, and reviews that come back just before you forget.')}
      <section class="psec"><button class="feature" data-add="languages"><span class="ic">${ICON.lang}</span><span><b>Pick a language</b><span>Around 25 languages, plus British Sign Language</span></span>${ICON.chev}</button></section>`;
    el.querySelector('[data-add]')!.addEventListener('click', () => openChat('languages'));
    return;
  }
  el.innerHTML = head('Languages', 'Phrases are written by Knowfeed and checked by native speakers. Unchecked ones are labelled.') + langs.map(l => {
    if (l.name === BSL) {
      const signCards = (data.learn?.cards || []).filter(c => c.topic === 'sign');
      return `<section class="psec lang"><h2>British Sign Language</h2><div class="sign-box">${signSVG()}</div><p class="note">The BSL vowels: thumb is A, then E, I, O, U across the fingertips. More signs will be added once Deaf BSL teachers have made or checked them.</p>${signCards.length ? `<div class="rows">${signCards.map(c => learnRow(c, 'BSL and Deaf culture')).join('')}</div>` : ''}</section>`;
    }
    if (!hasPack(l.name)) return `<section class="psec lang"><h2>${esc(l.name)}</h2><p class="note">The ${esc(l.name)} phrase pack is being written. It'll appear here as soon as it's ready, and your phrase of the day will start then.</p><button class="feature" data-wiki="${esc(LANG_WIKI[l.name])}"><span class="ic">${ICON.book}</span><span><b>About the ${esc(l.name)} language</b><span>From Wikipedia</span></span>${ICON.chev}</button></section>`;
    const pod = phraseOfDay(l.name, l.goal, l.level);
    const dueN = srs.due({ kind: 'phrase', lang: l.name, mark: false, perLang: 99 }).length;
    return `<section class="psec lang" data-lang="${esc(l.name)}"><h2>${esc(l.name)}</h2><p class="progress-l">${esc(progressLine(l.name))}</p>
      ${pod ? `<div class="pod"><p class="rk">PHRASE OF THE DAY</p>${pod.checked ? '' : '<span class="unchecked">Not yet checked</span>'}<p class="ph" lang="${esc(LANG_CODE[l.name])}">${esc(pod.phrase)}</p>${pod.romanisation ? `<p class="roman">${esc(pod.romanisation)}</p>` : ''}<p class="say">Say it: <b>${esc(pod.say)}</b></p><p>${esc(pod.meaning)}. ${esc(pod.when)}</p><div class="choices"><button class="choice hear" data-p="${esc(pod.id)}">${ICON.speaker} Hear it</button><button class="choice slow" data-p="${esc(pod.id)}">Slowly</button></div></div>` : `<p class="note">You've met every phrase in this pack. Reviews carry on, and you can review everything again from the settings chat.</p>`}
      <div class="choices"><button class="cta lesson">5-minute lesson</button>${dueN ? `<button class="cta ghost rev">Review ${dueN}</button>` : ''}</div>
      <details class="pack"><summary>Phrase pack · ${PACKS[l.name].length} phrases</summary>${packHTML(l.name)}</details></section>`;
  }).join('') + `<p class="pfoot"><button class="linkish" data-add="languages">Change languages</button></p>`;
  el.querySelectorAll<HTMLElement>('[data-add]').forEach(b => b.addEventListener('click', () => openChat('languages')));
  el.querySelectorAll<HTMLElement>('[data-wiki]').forEach(b => b.addEventListener('click', () => openWiki(b.dataset.wiki!)));
  el.querySelectorAll<HTMLElement>('section.lang[data-lang]').forEach(sec => {
    const lang = sec.dataset.lang!;
    sec.querySelector('.lesson')?.addEventListener('click', () => startLesson(lang));
    sec.querySelector('.rev')?.addEventListener('click', () => startReview());
    sec.querySelectorAll<HTMLElement>('.hear,.slow,.say-btn').forEach(b => b.addEventListener('click', () => {
      const ph = PACKS[lang].find(x => x.id === b.dataset.p); if (ph) speakIn(ph.phrase, lang, b.classList.contains('slow') ? 0.55 : 0.9);
    }));
  });
  wireRows(el, data.learn?.cards || []);
}

const THEMES: Record<string, string> = {
  'greetings-introductions': 'Greetings and introductions', 'polite-basics': 'Polite basics', 'cafe-restaurant': 'Café and restaurant',
  'shopping-money': 'Shopping and money', 'getting-around': 'Getting around', 'family-friends': 'Family and friends', 'at-home': 'At home',
  'feelings-small-talk': 'Feelings and small talk', work: 'Work', 'time-numbers-days': 'Time, numbers and days', 'problems-help': 'Problems and help',
};
function packHTML(lang: string): string {
  const pack = PACKS[lang];
  const themes = [...new Set(pack.map(p => p.theme))];
  return themes.map(t => `<h4>${esc(THEMES[t] || t)}</h4><ul class="plist">${pack.filter(p => p.theme === t).map(p => {
    const it = srs.get(srs.phraseKey(lang, p));
    return `<li><button class="say-btn" data-p="${esc(p.id)}" aria-label="Hear it">${ICON.speaker}</button><span><b lang="${esc(LANG_CODE[lang])}">${esc(p.phrase)}</b>${p.romanisation ? ` <i>${esc(p.romanisation)}</i>` : ''}<span>${esc(p.meaning)}${p.checked ? '' : ' · <em>Not yet checked</em>'}${it?.learned ? ' · learned' : it ? ' · seen' : ''}</span></span></li>`;
  }).join('')}</ul>`).join('');
}

/* ---------- Saved ---------- */

function savedPage(el: HTMLElement) {
  const items = S.saved;
  const follows = S.follows;
  const ents = [...S.entities];
  el.innerHTML = `${head('Saved', items.length ? plural(items.length, 'thing') + ' kept for later' : 'Tap the bookmark on any card to keep it here.')}
    ${items.length ? `<section class="psec"><div class="rows">${items.map(x => {
      const img = x.story?.image?.url || x.learn?.image || x.hub?.image;
      return `<div class="row-wrap"><button class="row" data-saved="${esc(x.id)}">${thumb(img, { topic: x.topic, id: x.id })}<span class="rt"><span class="rk">${esc((x.kind === 'story' && x.story ? storyLabel(x.story) : x.kind === 'skill' ? 'Skill' : x.kind === 'quiz' ? 'Quiz' : x.kind === 'hub' ? 'HubSpot' : x.learn ? learnCard(x.learn).label : '').toUpperCase())} · SAVED ${esc(ago(x.at).toUpperCase())}</span><b>${esc(x.title)}</b></span></button><button class="unsave" data-unsave="${esc(x.id)}" aria-label="Remove">${ICON.close}</button></div>`;
    }).join('')}</div></section>` : ''}
    <section class="psec"><h2>Following</h2>
      ${follows.length ? `<div class="rows">${follows.map(f => { const s = allStories().find(x => x.id === f.id || x.articles.some(a => f.urls.includes(a.url))); const upd = s && s.articles.length > f.seenCount; return `<div class="row-wrap"><button class="row" data-follow="${esc(f.id)}"><span class="rt"><span class="rk">STORY${upd ? ' · <em>NEW COVERAGE</em>' : s ? '' : ' · NO NEW COVERAGE LATELY'}</span><b>${esc(s?.title || f.title)}</b></span></button><button class="unsave" data-unfollow="${esc(f.id)}" aria-label="Stop following">${ICON.close}</button></div>`; }).join('')}</div>` : '<p class="note">Tap <b>Follow story</b> on any story to get updates at the top of your editions.</p>'}
      ${ents.length ? `<div class="chips">${ents.map(n => `<button class="chip-btn on" data-ent="${esc(n)}">${esc(titleCase(n))} ${ICON.close}</button>`).join('')}</div>` : ''}
    </section>`;
  el.querySelectorAll<HTMLElement>('[data-saved]').forEach(b => b.addEventListener('click', () => {
    const x = S.saved.find(i => i.id === b.dataset.saved); if (!x) return;
    if (x.story) openStory(x.story); else if (x.learn) openLearn(x.learn); else if (x.skill) openSkill(x.skill);
    else if (x.hub) window.open(x.hub.url, '_blank', 'noopener');
    else if (x.quiz) { const s = openSheet('<div class="quiz-sheet"></div>', 'Quiz'); const n = render({ id: x.quiz.id, kind: 'quiz', topic: x.quiz.topic, label: 'Quiz', quiz: x.quiz }); n.classList.add('inline'); s.querySelector('.quiz-sheet')!.appendChild(n); }
  }));
  el.querySelectorAll<HTMLElement>('[data-unsave]').forEach(b => b.addEventListener('click', () => { S.saved = S.saved.filter(x => x.id !== b.dataset.unsave); persist.saved(); toast('Removed from Saved'); go('saved'); }));
  el.querySelectorAll<HTMLElement>('[data-follow]').forEach(b => b.addEventListener('click', () => { const f = S.follows.find(x => x.id === b.dataset.follow); const s = f && allStories().find(x => x.id === f.id || x.articles.some(a => f.urls.includes(a.url))); if (s) openStory(s); else toast('No new coverage of this story lately'); }));
  el.querySelectorAll<HTMLElement>('[data-unfollow]').forEach(b => b.addEventListener('click', () => { S.follows = S.follows.filter(x => x.id !== b.dataset.unfollow); persist.follows(); toast('Stopped following'); go('saved'); }));
  el.querySelectorAll<HTMLElement>('[data-ent]').forEach(b => b.addEventListener('click', () => { S.entities.delete(b.dataset.ent!); persist.entities(); toast(`Unfollowed ${titleCase(b.dataset.ent!)}`); go('saved'); }));
  fixImages(el);
}
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, m => m.toUpperCase());

/* ---------- Search ---------- */

function searchPage(el: HTMLElement) {
  el.innerHTML = `${head('Search')}<form class="sform" role="search"><input type="search" id="q" placeholder="Stories, topics, people, places" autocomplete="off" enterkeyhint="search" aria-label="Search"></form><div id="results"></div>`;
  const q = el.querySelector<HTMLInputElement>('#q')!;
  const out = el.querySelector<HTMLElement>('#results')!;
  let t: ReturnType<typeof setTimeout>;
  const run = () => {
    const v = q.value.trim();
    if (v.length < 2) { out.innerHTML = '<p class="note">Search today\'s stories and learning, or look anything up on Wikipedia.</p>'; return; }
    const re = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const seen = new Set<string>();
    const stories = allStories().filter(s => (seen.has(s.id) ? false : (seen.add(s.id), true)) && (re.test(s.title) || re.test(s.standfirst) || s.entities?.some(e => re.test(e.name)))).slice(0, 12);
    const learn = (data.learn?.cards || []).filter(c => re.test(c.title) || re.test(c.extract)).slice(0, 8);
    out.innerHTML = `${stories.length ? `<section class="psec"><h2>Stories</h2><div class="rows">${stories.map(storyRow).join('')}</div></section>` : ''}
      ${learn.length ? `<section class="psec"><h2>Learning</h2><div class="rows">${learn.map(c => learnRow(c, learnCard(c).label)).join('')}</div></section>` : ''}
      <section class="psec"><button class="feature" data-wiki="${esc(v)}"><span class="ic">${ICON.search}</span><span><b>Look up “${esc(v)}”</b><span>On Wikipedia</span></span>${ICON.chev}</button></section>`;
    wireRows(out, learn, stories);
    out.querySelector<HTMLElement>('[data-wiki]')!.addEventListener('click', async () => { const w = await wiki(v); if (w) openWiki(w.title); else toast("Wikipedia doesn't have a page with that name"); });
  };
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 180); });
  el.querySelector('form')!.addEventListener('submit', e => { e.preventDefault(); run(); q.blur(); });
  run();
  setTimeout(() => q.focus(), 50);
}

export function initPages() {
  onTab('learn', learnPage);
  onTab('langs', langsPage);
  onTab('saved', savedPage);
  onTab('search', searchPage);
}
