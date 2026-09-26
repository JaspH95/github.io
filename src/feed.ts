import { S, save, saveLater, saveLiked, saveFollowed, isLater, markSeen } from './state';
import { TOPICS, BLURB } from './content';
import { scene, signSVG } from './scenes';
import { esc, safeUrl, ago, toast, seedFor, ICON } from './util';
import { buildOrder, sceneFor, type Card, type Data, type Match } from './cards';
import { openArticle, openWorkList } from './article';
import { speakIn } from './audio';
import { answerReview, progressLine } from './phrases';
import { openChat } from './chat';
import { exportData, importData } from './backup';

export const feed = document.getElementById('feed')!;
export let data: Data = {};
export const setData = (d: Data) => { data = d; };

export const label = (c: Card) =>
  c.t === 'local' && c.tag ? `Local: ${c.tag}` : (c.t === 'sport' || c.t === 'lang' || c.t === 'sign') && c.tag ? c.tag : TOPICS[c.t];

export const cardTitle = (c: Card): string =>
  c.story?.title || c.learn?.title || c.quiz?.q || c.hub?.title || (c.phrase ? `${c.phrase.lang}: ${c.phrase.p.meaning}` : '') ||
  (c.type === 'signday' ? 'Sign of the day: the BSL vowels' : c.type === 'live' || c.type === 'result' ? matchLine(c.match!) : c.type === 'f1' ? f1Title(c) : '');

export const matchLine = (m: Match) => `${m.home.name} ${m.score.home ?? 0}–${m.score.away ?? 0} ${m.away.name}`;
const f1Title = (c: Card) => (c.id.startsWith('f1-r') && c.f1?.last ? `${c.f1.last.race}: result` : c.f1?.next ? `Next up: ${c.f1.next.race}` : 'Formula 1');

function background(c: Card): string {
  if (c.type === 'signday') return signSVG();
  const fallback = scene(sceneFor(c), seedFor(c.id));
  if (!c.image) return fallback;
  return `<img class="scene photo" src="${safeUrl(c.image)}" alt="" decoding="async" referrerpolicy="no-referrer">`;
}
/* If a photo fails to load, swap in the topic's illustrated scene */
function fixImages(el: HTMLElement, c: Card) {
  el.querySelectorAll<HTMLImageElement>('img.photo').forEach(img => img.addEventListener('error', () => {
    const tmp = document.createElement('div'); tmp.innerHTML = scene(sceneFor(c), seedFor(c.id)); img.replaceWith(tmp.firstElementChild!);
  }, { once: true }));
}
export { background as heroBackground, fixImages };

function actionsHTML(c: Card) {
  const on = S.liked.has(c.id), lat = isLater(c.id);
  return `<div class="actions">
    <button class="act like ${on ? 'on' : ''}" aria-label="Like" aria-pressed="${on}">${ICON.heart}</button><span class="act-label">Like</span>
    <button class="act later ${lat ? 'on' : ''}" aria-label="Read later" aria-pressed="${lat}">${ICON.clock}</button><span class="act-label">Later</span>
    <button class="act deep" aria-label="Read more">${ICON.book}</button><span class="act-label">Read more</span></div>`;
}

export function matchHTML(c: Card) {
  const m = c.match!;
  const live = c.type === 'live';
  const clock = live ? (m.status === 'HT' ? 'HT' : m.elapsed != null ? `${m.elapsed}'` : m.status) : 'Full time';
  const ev = [...m.events].reverse().find(e => e.type === 'Goal' || e.type === 'Card');
  const evText = ev ? `${ev.type === 'Goal' ? (ev.detail === 'Own Goal' ? 'Own goal' : ev.detail === 'Missed Penalty' ? 'Missed penalty' : 'Goal') : ev.detail}: ${ev.player || ''} (${ev.team}) ${ev.min ?? ''}${ev.extra ? '+' + ev.extra : ''}'` : '';
  return `<div class="live" data-live="${m.id}"><div class="clock ${live ? '' : 'ft'}"><i></i>${live ? 'LIVE ' : ''}<span class="t">${esc(clock)}</span></div>
    <div class="score"><span>${esc(m.home.name)}</span><b class="sc">${m.score.home ?? 0} – ${m.score.away ?? 0}</b><span>${esc(m.away.name)}</span></div>
    ${evText ? `<p class="event">${esc(evText)}</p>` : ''}${m.league ? `<p class="src-line">${esc(m.league)}${m.round ? ' · ' + esc(m.round) : ''}</p>` : ''}</div>`;
}

function body(c: Card): string {
  const attrib = (src: string, url: string) => `<p class="attrib">From <a href="${safeUrl(url)}" target="_blank" rel="noopener">${esc(src)}</a>${src === 'Wikipedia' ? ' (CC BY-SA)' : ''}</p>`;
  switch (c.type) {
    case 'news': {
      const s = c.story!;
      const more = s.also.length ? ` · ${s.also.length + 1} outlets` : '';
      return `<p class="meta">${esc(s.outlet)} · ${esc(ago(s.published))}${more}</p><h2 class="news">${esc(s.title)}</h2>${s.standfirst ? `<p class="stand">${esc(s.standfirst)}</p>` : ''}`;
    }
    case 'learn': {
      const l = c.learn!;
      const kicker = { featured: "Wikipedia's featured article today", mostread: 'Most read on Wikipedia today', potd: 'Picture of the day', onthisday: 'On this day', topic: '', apod: 'NASA Astronomy Picture of the Day' }[l.kind];
      if (l.kind === 'onthisday') return `<p class="myth-label">${kicker}</p><div class="big">${l.year}</div><p class="stand"><strong>${esc(l.event)}</strong></p>${attrib('Wikipedia', l.url)}`;
      if (l.kind === 'potd') return `<p class="myth-label">${kicker}</p><p class="stand">${esc(l.extract)}</p>${attrib('Wikimedia Commons', l.url)}`;
      return `${kicker ? `<p class="myth-label">${kicker}</p>` : ''}<h2>${esc(l.title)}</h2><p class="stand">${esc(l.extract)}</p>${attrib(l.source === 'NASA' ? 'NASA' : 'Wikipedia', l.url)}`;
    }
    case 'quiz': {
      const q = c.quiz!;
      return `<p class="myth-label">Quiz</p><h2>${esc(q.q)}</h2>${q.prompt ? `<p class="quiz-prompt">${esc(q.prompt)}</p>` : ''}<div class="opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div><p class="explain">${esc(q.explain)} <span class="src-line">Source: <a href="${safeUrl(q.source.url)}" target="_blank" rel="noopener">${esc(q.source.name)}</a></span></p>`;
    }
    case 'hubspot': {
      const h = c.hub!;
      return `<p class="meta">${h.kind === 'changelog' ? 'HubSpot developer changelog' : 'HubSpot blog'} · ${esc(ago(h.published))}</p><h2 class="news">${esc(h.title)}</h2>${h.summary ? `<p class="stand">${esc(h.summary)}</p>` : ''}`;
    }
    case 'phrase': {
      const { lang, p } = c.phrase!;
      return `<p class="myth-label">${esc(lang)} phrase of the day</p>${p.checked ? '' : '<span class="unchecked">Not yet checked</span>'}<h2 class="phrase">${esc(p.phrase)}</h2>${p.romanisation ? `<p class="say"><strong>${esc(p.romanisation)}</strong></p>` : ''}<p class="say">Say it: <strong>${esc(p.say)}</strong></p><p><strong>${esc(p.meaning)}</strong>. ${esc(p.when)}</p><div class="choices"><button class="choice yes hear">Hear it</button><button class="choice slow">Slowly</button></div><p class="progress-line">${esc(progressLine(lang))}</p>`;
    }
    case 'review': {
      const { lang, p } = c.phrase!;
      return `<p class="myth-label">Remember this? · ${esc(lang)}</p><h2>${esc(p.meaning)}</h2><button class="cta show-phrase">Show the phrase</button>
        <div class="review-reveal">${p.checked ? '' : '<span class="unchecked">Not yet checked</span>'}<h2 class="phrase">${esc(p.phrase)}</h2>${p.romanisation ? `<p class="say"><strong>${esc(p.romanisation)}</strong></p>` : ''}<p class="say">Say it: <strong>${esc(p.say)}</strong></p>
        <div class="choices"><button class="choice hear">Hear it</button><button class="choice slow">Slowly</button></div>
        <div class="choices grade"><button class="choice yes got">Got it</button><button class="choice no notyet">Not yet</button></div></div>`;
    }
    case 'signday':
      return `<p class="myth-label">Sign of the day</p><h2>The BSL vowels</h2><p>Thumb is <strong>A</strong>, then <strong>E, I, O, U</strong> across the fingertips. Watch the finger move.</p>`;
    case 'live': case 'result': return matchHTML(c);
    case 'f1': {
      const f = c.f1!;
      if (c.id.startsWith('f1-r') && f.last) return `<p class="myth-label">Race result · Round ${f.last.round}</p><h2>${esc(f.last.race)}</h2><ol class="results">${f.last.results.slice(0, 3).map(r => `<li><b>${r.pos}</b><span>${esc(r.driver)}</span><span>${esc(r.team)}</span></li>`).join('')}</ol><p class="attrib">Results from Jolpica F1</p>`;
      const n = f.next!;
      const when = new Date(`${n.date}T${n.time || '12:00:00Z'}`);
      return `<p class="myth-label">Next race · Round ${n.round}</p><h2>${esc(n.race)}</h2><p><strong>${esc(when.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: n.time ? '2-digit' : undefined, minute: n.time ? '2-digit' : undefined }))}</strong></p><p>${esc(n.circuit)}, ${esc(n.locality)}, ${esc(n.country)}</p><p class="attrib">Calendar from Jolpica F1</p>`;
    }
    case 'discover': {
      const t = c.discover!;
      return `<h2>Something new: ${esc(TOPICS[t].toLowerCase())}</h2><p>${esc(BLURB[t] || '')}</p><div class="choices"><button class="choice yes">Add to my feed</button><button class="choice no">Not for me</button></div>`;
    }
  }
  return '';
}

function tags(c: Card) {
  return `${c.isUpdate ? '<span class="tag">Following</span>' : ''}${c.isLater ? '<span class="tag">Read later</span>' : ''}${c.type === 'discover' ? '<span class="tag">Suggested</span>' : ''}${c.type === 'hubspot' && c.hub?.kind === 'changelog' ? '<span class="tag">New in HubSpot: try it</span>' : ''}`;
}

function introEnd(c: Card): HTMLElement {
  const el = document.createElement('section');
  el.dataset.id = c.id; el.className = 'card plain';
  const top = Object.entries(S.weights).filter(e => (e[1] || 0) > 0 && !['local', 'sport', 'lang'].includes(e[0])).sort((a, b) => b[1]! - a[1]!).slice(0, 2).map(e => TOPICS[e[0] as keyof typeof TOPICS]);
  const hi = S.profile?.name ? `Fresh feed for you, ${esc(S.profile.name)}.` : 'Fresh feed, built just now.';
  const stale = !data.news && !data.learn;
  const work = S.work.length ? `<button class="cta ghost worklist-btn">Your work list (${S.work.length})</button>` : '';
  el.innerHTML = c.type === 'intro'
    ? `<div class="inner"><h2>${c.n ? `${c.n} saved for you, up first.` : hi}</h2>
       ${c.n ? `<p>You marked ${c.n === 1 ? 'this' : 'these'} to read later. Tap <strong>Read more</strong> to open the full article; it's cleared from your list once read.</p>` : '<p>Double tap or hit the heart on anything interesting. Tap <strong>Read more</strong> for the full article.</p>'}
       ${stale ? "<p>Couldn't reach the latest news just now. Showing what's saved on this phone.</p>" : ''}
       ${top.length ? `<p>Leaning towards <strong>${top.join(' and ')}</strong>.</p>` : ''}
       ${work}
       <div class="hint"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>Swipe up to start</div></div>`
    : `<div class="inner"><h2>You're all caught up.</h2><div class="stats"><div><b id="endLiked">0</b><span>liked</span></div><div><b id="endLater">0</b><span>read later</span></div><div><b id="endQuiz">0/0</b><span>quiz</span></div></div><p>Reopen for a fresh feed. Anything you marked for later will be waiting at the top.</p><div class="choices"><button class="cta" id="rebuild">Refresh my feed</button><button class="cta ghost" id="redo">Change my feed</button>${work}</div>
       <div class="backup"><button class="cta ghost" id="exportBtn">Back up my data</button><button class="cta ghost" id="importBtn">Restore from a file</button></div></div>`;
  el.querySelector('#rebuild')?.addEventListener('click', () => { refresh(); });
  el.querySelector('#redo')?.addEventListener('click', () => openChat());
  el.querySelector('.worklist-btn')?.addEventListener('click', openWorkList);
  el.querySelector('#exportBtn')?.addEventListener('click', exportData);
  el.querySelector('#importBtn')?.addEventListener('click', importData);
  return el;
}

export function render(c: Card): HTMLElement {
  if (c.type === 'intro' || c.type === 'end') return introEnd(c);
  const el = document.createElement('section');
  el.dataset.id = c.id;
  el.className = `card t-${c.t}`;
  let html = background(c) + '<div class="shade"></div><div class="inner">';
  html += `<span class="topic">${esc(label(c))}</span>${tags(c)}`;
  if (c.reason) html += `<p class="why">${esc(c.reason)}</p>`;
  html += body(c) + '</div>';
  if (c.type !== 'discover') html += actionsHTML(c);
  el.innerHTML = html;
  (el as any)._card = c;
  fixImages(el, c);

  const phraseText = () => c.phrase!.p.phrase;
  el.querySelector('.hear')?.addEventListener('click', () => speakIn(phraseText(), c.phrase!.lang, 0.9));
  el.querySelector('.slow')?.addEventListener('click', () => speakIn(phraseText(), c.phrase!.lang, 0.55));
  el.querySelector('.show-phrase')?.addEventListener('click', e => { (e.currentTarget as HTMLElement).remove(); el.querySelector('.review-reveal')!.classList.add('show'); });
  const grade = (ok: boolean) => {
    answerReview(c.phrase!.lang, c.phrase!.p.id, ok);
    el.querySelector('.grade')!.outerHTML = `<p><strong>${ok ? 'Nice.' : 'No problem.'}</strong> ${ok ? "It'll come back later to check it's stuck." : "It'll come back tomorrow."}</p><p class="progress-line">${esc(progressLine(c.phrase!.lang))}</p>`;
  };
  el.querySelector('.got')?.addEventListener('click', () => grade(true));
  el.querySelector('.notyet')?.addEventListener('click', () => grade(false));
  el.querySelector('.like')?.addEventListener('click', () => toggleLike(c));
  el.querySelector('.later')?.addEventListener('click', () => toggleLater(c));
  el.querySelector('.deep')?.addEventListener('click', () => openArticle(c));
  el.querySelectorAll<HTMLButtonElement>('.opt').forEach(o => o.addEventListener('click', () => {
    if (el.dataset.answered) return; el.dataset.answered = '1';
    const k = +o.dataset.k!; S.quiz.done++; if (k === c.quiz!.answer) S.quiz.right++;
    el.querySelectorAll<HTMLButtonElement>('.opt').forEach(x => { const xk = +x.dataset.k!; if (xk === c.quiz!.answer) x.classList.add('right'); else if (xk === k) x.classList.add('wrong'); });
    el.querySelector('.explain')!.classList.add('show'); counts();
  }));
  if (c.type === 'discover') {
    const t = c.discover!;
    el.querySelector('.choice.yes')?.addEventListener('click', () => {
      S.accepted.add(t); S.weights[t] = (S.weights[t] || 0) + 1; save('kf-accepted', [...S.accepted]); save('kf-weights', S.weights);
      let after: Element = el;
      (c.pool || []).forEach(p => { const n = render({ ...p, reason: `Because you added ${TOPICS[t].toLowerCase()}` }); after.after(n); observe(n); after = n; });
      el.querySelector('.choices')!.innerHTML = '<p><strong>Added.</strong> Swipe up for your first ones.</p>';
      toast(`${TOPICS[t]} added to your feed`);
    });
    el.querySelector('.choice.no')?.addEventListener('click', () => {
      S.declined.add(t); save('kf-declined', [...S.declined]);
      el.querySelector('.choices')!.innerHTML = `<p><strong>Got it.</strong> No more ${esc(TOPICS[t].toLowerCase())}.</p>`;
      toast('Noted, keep swiping');
    });
  }

  // Double tap to like, with a heart burst
  let last = 0;
  el.addEventListener('pointerup', e => {
    if ((e.target as HTMLElement).closest('button,a') || c.type === 'discover') return;
    const now = Date.now();
    if (now - last < 300) { const b = el.getBoundingClientRect(); burst(el, e.clientX - b.left, e.clientY - b.top); if (!S.liked.has(c.id)) toggleLike(c); last = 0; }
    else last = now;
  });
  return el;
}

function burst(el: HTMLElement, x: number, y: number) {
  const h = document.createElement('div'); h.className = 'burst'; h.style.left = x + 'px'; h.style.top = y + 'px';
  h.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 20.5S3.5 15.6 3.5 9.3A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.5c0 6.3-8.5 11.2-8.5 11.2z"/></svg>';
  el.appendChild(h); setTimeout(() => h.remove(), 850);
}

/* Keep every copy of a button (card + open article) in sync */
export function syncButtons(c: Card) {
  const sel = (cls: string) => document.querySelectorAll<HTMLElement>(`[data-id="${CSS.escape(c.id)}"] .${cls}, #article[data-for="${CSS.escape(c.id)}"] .${cls}`);
  sel('like').forEach(b => { b.classList.toggle('on', S.liked.has(c.id)); b.setAttribute('aria-pressed', String(S.liked.has(c.id))); });
  sel('later').forEach(b => { const on = isLater(c.id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); const l = b.querySelector('.lbl'); if (l) l.textContent = on ? 'Saved for later' : 'Read later'; });
}

export function toggleLike(c: Card) {
  const on = !S.liked.has(c.id);
  on ? S.liked.add(c.id) : S.liked.delete(c.id);
  S.weights[c.t] = Math.max(0, (S.weights[c.t] || 0) + (on ? 1 : -1));
  saveLiked(); save('kf-weights', S.weights); syncButtons(c);
  document.querySelectorAll(`[data-id="${CSS.escape(c.id)}"] .like`).forEach(b => { b.classList.remove('pop'); void (b as HTMLElement).offsetWidth; b.classList.add('pop'); });
  if (on) {
    // Pull the next card on the same topic up the feed
    const el = feed.querySelector(`[data-id="${CSS.escape(c.id)}"]`); const cards = [...feed.children] as HTMLElement[]; const here = el ? cards.indexOf(el as HTMLElement) : -1;
    const next = here >= 0 && cards.slice(here + 2).find(n => n.classList.contains('t-' + c.t) && !n.dataset.seen);
    if (next && el) { el.after(next); toast(`More ${TOPICS[c.t].toLowerCase()} coming up`); }
    else toast(`Liked. More ${TOPICS[c.t].toLowerCase()} next time`);
  }
  counts();
}

export function toggleLater(c: Card) {
  if (isLater(c.id)) { S.later = S.later.filter(x => x.id !== c.id); toast('Removed from read later'); }
  else { const { isLater: _drop, reason: _r, ...keep } = c; S.later.push(keep); toast("Saved. It'll be first next time you open"); }
  saveLater(); syncButtons(c); counts();
}

export function counts() {
  document.getElementById('likePill')!.textContent = S.later.length ? `${S.later.length} to read` : `${S.liked.size} liked`;
  const set = (id: string, v: string | number) => { const n = document.getElementById(id); if (n) n.textContent = String(v); };
  set('endLiked', S.liked.size); set('endLater', S.later.length); set('endQuiz', `${S.quiz.right}/${S.quiz.done}`);
}

/* ---------- Scroll tracking ---------- */
export let currentEl: HTMLElement | null = null;
export const setCurrent = (el: HTMLElement | null) => { currentEl = el; };
const prog = document.getElementById('prog')!, topBar = document.getElementById('top')!;
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting || en.intersectionRatio <= 0.6) return;
    const el = en.target as HTMLElement;
    el.dataset.seen = '1'; currentEl = el;
    const cards = [...feed.children]; const i = cards.indexOf(el);
    prog.style.width = `${(i / Math.max(1, cards.length - 1)) * 100}%`;
    topBar.classList.toggle('light', el.classList.contains('plain'));
    const c: Card | undefined = (el as any)._card;
    if (c) {
      markSeen(c.id);
      // A followed story's update counts as caught up once you've seen it
      if (c.isUpdate && c.story) {
        const f = S.followed.find(x => x.id === c.followId);
        if (f) { f.seen = [...new Set([...f.seen, c.story.url, ...c.story.also.map(a => a.url)])]; saveFollowed(); }
      }
    }
  });
}, { root: feed, threshold: [0.6] });
export const observe = (n: Element) => io.observe(n);

export function build() {
  feed.innerHTML = ''; S.quiz = { right: 0, done: 0 };
  buildOrder(data).forEach(c => { const n = render(c); feed.appendChild(n); observe(n); });
  counts();
}

/* Pinned cards (live football and results) slot in just after the intro card */
export function pinTop(c: Card, rank: number) {
  const n = render(c); observe(n);
  n.dataset.pinned = String(rank);
  const existing = feed.querySelector(`[data-id="${CSS.escape(c.id)}"]`);
  if (existing) { existing.replaceWith(n); return; }
  const before = [...feed.querySelectorAll<HTMLElement>('[data-pinned]')].filter(x => +x.dataset.pinned! <= rank).pop();
  (before || feed.querySelector('[data-id="intro"]'))?.after(n);
}
export function unpin(id: string) { feed.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove(); }

let refreshHook: () => void = () => { build(); };
export const onRefresh = (fn: () => void) => { refreshHook = fn; };
export function refresh() { refreshHook(); feed.scrollTo({ top: 0 }); }
