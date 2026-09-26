import { S, isLater, saveLater, saveFollowed, saveWork } from './state';
import { esc, safeUrl, ago, toast, ICON } from './util';
import { label, cardTitle, heroBackground, fixImages, toggleLike, toggleLater, syncButtons, counts } from './feed';
import { playQueue, stopAudio, speakIn } from './audio';
import { seenPhrases, progressLine } from './phrases';
import type { Card } from './cards';

export const art = document.getElementById('article')!;

const para = (text: string) => text.split(/\n+/).map(t => t.trim()).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('');
const attribution = (source: string, url: string, title: string) =>
  source === 'NASA'
    ? `<p class="attrib-a">From <a href="${safeUrl(url)}" target="_blank" rel="noopener">NASA Astronomy Picture of the Day</a>. Explanation written by NASA.</p>`
    : `<p class="attrib-a">From Wikipedia: <a href="${safeUrl(url)}" target="_blank" rel="noopener">${esc(title)}</a>. Text available under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</p>`;

/* The body of the article for each kind of card, plus the plain text to read aloud */
function content(c: Card): { html: string; speech: string[]; meta: string } {
  switch (c.type) {
    case 'news': {
      const s = c.story!;
      const outlets = [s.outlet, ...s.also.map(a => a.outlet)];
      const summary = s.summary?.sections?.length
        ? `<p class="a-label">Summary by AI from ${esc(s.outlet)}</p>${s.summary.sections.map(x => `<h3>${esc(x.heading)}</h3><p>${esc(x.text)}</p>`).join('')}`
        : `<p class="a-label">From ${esc(s.outlet)}</p><p class="a-lede">${esc(s.standfirst || 'Open the full story for the details.')}</p>`;
      const also = s.also.length ? `<h3>Also covered by</h3><ul class="also">${s.also.map(a => `<li><a href="${safeUrl(a.url)}" target="_blank" rel="noopener"><b>${esc(a.outlet)}</b>${esc(a.title)}</a></li>`).join('')}</ul>` : '';
      const check = `<div class="src"><h3>Source check</h3><p><strong>Covered by ${outlets.length} outlet${outlets.length === 1 ? '' : 's'}</strong> in the feeds Knowfeed reads: ${esc(outlets.join(', '))}.</p>${s.summary ? `<p class="src-note">The summary was written by AI (${esc(s.summary.model)}) using only the ${esc(s.outlet)} article's text. Check the original for anything important.</p>` : ''}</div>`;
      const speech = s.summary ? s.summary.sections.map(x => `${x.heading}. ${x.text}`) : [s.standfirst];
      return { html: summary + also + check + `<a class="cta full-story" href="${safeUrl(s.url)}" target="_blank" rel="noopener">Read the full story on ${esc(s.outlet)}</a>`, speech, meta: `${s.outlet} · ${ago(s.published)}` };
    }
    case 'learn': {
      const l = c.learn!;
      const lead = l.kind === 'onthisday' ? `<p class="a-lede"><strong>${l.year}:</strong> ${esc(l.event)}</p>` : '';
      const credit = l.credit ? `<p class="src-note">Image credit: ${esc(l.credit)}</p>` : '';
      return {
        html: lead + para(l.extract) + credit + attribution(l.source, l.url, l.title) + `<a class="cta full-story" href="${safeUrl(l.url)}" target="_blank" rel="noopener">Read more on ${l.source === 'NASA' ? 'NASA' : l.kind === 'potd' ? 'Wikimedia Commons' : 'Wikipedia'}</a>`,
        speech: [...(l.event ? [`${l.year}. ${l.event}`] : []), l.extract],
        meta: l.source === 'NASA' ? 'NASA' : 'Wikipedia',
      };
    }
    case 'quiz': {
      const q = c.quiz!; const a = q.article;
      return {
        html: `<p class="a-lede">The answer: <strong>${esc(q.opts[q.answer])}</strong>. ${esc(q.explain)}</p>${q.prompt ? `<p>${esc(q.prompt)}</p>` : ''}`
          + (a ? `<h3>${esc(a.title)}</h3>${a.image ? `<img class="inline-photo" src="${safeUrl(a.image)}" alt="" referrerpolicy="no-referrer">` : ''}${para(a.extract)}${attribution('Wikipedia', a.url, a.title)}` : '')
          + `<div class="src"><h3>Source check</h3><p>Question and answer come from <a href="${safeUrl(q.source.url)}" target="_blank" rel="noopener">${esc(q.source.name)}</a>. Wrong answers are generated from the same data.</p></div>`,
        speech: [`The answer: ${q.opts[q.answer]}. ${q.explain}`, ...(a ? [a.extract] : [])],
        meta: 'Quiz',
      };
    }
    case 'hubspot': {
      const h = c.hub!; const inWork = S.work.some(x => x.id === h.id);
      return {
        html: `<p class="a-lede">${esc(h.summary || h.title)}</p>`
          + (h.kind === 'changelog' ? `<div class="steps"><h3>New in HubSpot: try it</h3><p>Save this to your work list and tick it off once you've tried it.</p><button class="cta add-work">${inWork ? 'On your work list' : 'Add to my work list'}</button></div>` : '')
          + `<a class="cta full-story" href="${safeUrl(h.url)}" target="_blank" rel="noopener">Read it on HubSpot</a>`,
        speech: [h.summary], meta: `${h.kind === 'changelog' ? 'HubSpot developer changelog' : 'HubSpot blog'} · ${ago(h.published)}`,
      };
    }
    case 'phrase': case 'review': {
      const { lang, p } = c.phrase!;
      const list = seenPhrases(lang);
      return {
        html: `<p class="a-lede"><strong>${esc(p.phrase)}</strong>${p.romanisation ? ` (${esc(p.romanisation)})` : ''}: ${esc(p.meaning)}. ${esc(p.when)}${p.checked ? '' : ' <span class="unchecked">Not yet checked</span>'}</p>${p.notes ? `<p>${esc(p.notes)}</p>` : ''}
          <p class="src-note">${esc(progressLine(lang))}. Tap a phrase to hear it.</p>
          <h3>Your ${esc(lang)} phrases so far</h3>${list.map(x => `<div class="phr-item"><p><button class="hear-p" data-p="${esc(x.phrase)}">${esc(x.phrase)}</button>${x.checked ? '' : '<span class="unchecked">Not yet checked</span>'}</p>${x.romanisation ? `<p class="say-l">${esc(x.romanisation)}</p>` : ''}<p class="say-l">Say it: ${esc(x.say)}</p><p>${esc(x.meaning)}. ${esc(x.when)}</p></div>`).join('')}`,
        speech: [`${p.meaning}. ${p.when}`], meta: 'Phrase pack',
      };
    }
    case 'signday':
      return {
        html: `<p class="a-lede">In BSL fingerspelling, vowels are shown by touching the fingertips of your non-dominant hand with your dominant index finger.</p><p>Thumb is A, index finger is E, middle finger is I, ring finger is O and little finger is U.</p><p class="src-note">A simplified animation to help you remember. Learning from Deaf BSL teachers is always best.</p>`,
        speech: ['Touch the thumb for A, then the fingertips for E, I, O and U.'], meta: 'Sign of the day',
      };
    case 'live': case 'result': {
      const m = c.match!;
      const ev = m.events.filter(e => e.type === 'Goal' || e.type === 'Card');
      return {
        html: `<p class="a-lede">${esc(m.home.name)} ${m.score.home ?? 0}–${m.score.away ?? 0} ${esc(m.away.name)} (${esc(m.statusLong)})</p>${ev.length ? `<h3>Key moments</h3><ul class="events">${ev.map(e => `<li>${e.min ?? ''}${e.extra ? '+' + e.extra : ''}' ${esc(e.type === 'Goal' ? e.detail === 'Own Goal' ? 'Own goal' : 'Goal' : e.detail)}: ${esc(e.player || '')} (${esc(e.team || '')})</li>`).join('')}</ul>` : ''}<p class="attrib-a">Live data from API-Football, refreshed every couple of minutes.</p>`,
        speech: [`${m.home.name} ${m.score.home ?? 0}, ${m.away.name} ${m.score.away ?? 0}. ${m.statusLong}.`], meta: m.league || 'Football',
      };
    }
    case 'f1': {
      const f = c.f1!;
      const res = f.last ? `<h3>${esc(f.last.race)}</h3><ol class="results">${f.last.results.map(r => `<li><b>${r.pos}</b><span>${esc(r.driver)} · ${esc(r.team)}</span><span>${esc(r.detail)}</span></li>`).join('')}</ol>` : '';
      const nx = f.next ? `<h3>Next: ${esc(f.next.race)}</h3><p>${esc(new Date(`${f.next.date}T${f.next.time || '12:00:00Z'}`).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}, ${esc(f.next.circuit)}.</p>` : '';
      return { html: res + nx + `<p class="attrib-a">Results and calendar from Jolpica F1.</p>`, speech: f.last ? [`${f.last.race}. ${f.last.results.slice(0, 3).map(r => `${r.pos}, ${r.driver}`).join('. ')}.`] : [], meta: 'Formula 1' };
    }
  }
  return { html: '', speech: [], meta: '' };
}

export function openArticle(c: Card) {
  stopAudio();
  const title = cardTitle(c);
  const { html, speech, meta } = content(c);
  const followId = c.story ? (c.followId || c.story.id) : '';
  const isFollowing = !!followId && S.followed.some(f => f.id === followId);
  art.dataset.for = c.id;
  art.className = `article t-${c.t}`;
  const hero = c.type === 'live' || c.type === 'result' ? heroBackground({ ...c, image: undefined }) : heroBackground(c);
  art.innerHTML = `
    <div class="a-hero">${hero}<div class="shade"></div>
      <button class="a-back" aria-label="Back to feed">${ICON.back}</button>
      <div class="a-grab" aria-hidden="true"></div>
      <div class="a-head"><span class="topic">${esc(label(c))}</span><h1>${esc(title)}</h1><span class="a-meta">${esc(meta)}</span></div></div>
    <div class="a-tools">
      <button class="tool listen">Listen</button>
      ${c.story ? `<button class="tool follow ${isFollowing ? 'on' : ''}">${isFollowing ? 'Following' : 'Follow story'}</button>` : ''}
    </div>
    <div class="a-body">${html}</div>
    <div class="a-bar">
      <button class="a-btn like ${S.liked.has(c.id) ? 'on' : ''}" aria-pressed="${S.liked.has(c.id)}">${ICON.heart}<span>Like</span></button>
      <button class="a-btn later ${isLater(c.id) ? 'on' : ''}" aria-pressed="${isLater(c.id)}">${ICON.clock}<span class="lbl">${isLater(c.id) ? 'Saved for later' : 'Read later'}</span></button>
    </div>`;
  fixImages(art, c);
  art.querySelector('.a-back')!.addEventListener('click', closeArticle);
  art.querySelectorAll<HTMLElement>('.hear-p').forEach(b => b.addEventListener('click', () => speakIn(b.dataset.p!, c.phrase!.lang, 0.8)));
  art.querySelector('.a-btn.like')!.addEventListener('click', () => toggleLike(c));
  art.querySelector('.a-btn.later')!.addEventListener('click', () => toggleLater(c));
  art.querySelector('.tool.listen')!.addEventListener('click', () => playQueue([title, ...speech].filter(Boolean).map(t => ({ text: t, label: title }))));
  art.querySelector('.tool.follow')?.addEventListener('click', e => {
    const b = e.currentTarget as HTMLElement; const on = !S.followed.some(f => f.id === followId);
    const s = c.story!;
    S.followed = on ? [...S.followed, { id: followId, title: s.title, seen: [s.url, ...s.also.map(a => a.url)], at: new Date().toISOString() }] : S.followed.filter(f => f.id !== followId);
    saveFollowed();
    b.classList.toggle('on', on); b.textContent = on ? 'Following' : 'Follow story';
    toast(on ? 'Following. Updates will appear at the top of your feed' : 'Stopped following');
  });
  art.querySelector('.add-work')?.addEventListener('click', e => {
    const h = c.hub!;
    if (S.work.some(x => x.id === h.id)) { openWorkList(); return; }
    S.work.push({ id: h.id, title: h.title, url: h.url, done: false }); saveWork();
    (e.currentTarget as HTMLElement).textContent = 'On your work list'; toast('Added to your work list');
  });
  art.scrollTop = 0;
  requestAnimationFrame(() => art.classList.add('open'));
  (art.querySelector('.a-back') as HTMLElement).focus({ preventScroll: true });
  // Read-later items are cleared once read
  if (isLater(c.id)) { S.later = S.later.filter(x => x.id !== c.id); saveLater(); syncButtons(c); counts(); setTimeout(() => toast('Marked as read'), 400); }
}

/* Work list: HubSpot "try it" items to tick off */
export function openWorkList() {
  stopAudio();
  art.dataset.for = ''; art.className = 'article t-hubspot';
  art.innerHTML = `<div class="a-body wl"><button class="a-back static" aria-label="Back to feed">${ICON.back}</button>
    <h1 class="wl-title">Your work list</h1><p class="src-note">New HubSpot features to try at work. Tick them off as you go.</p>
    ${S.work.length ? S.work.map(w => `<div class="wl-item" data-id="${esc(w.id)}"><label class="step"><input type="checkbox" ${w.done ? 'checked' : ''}><span>${esc(w.title)}</span></label><a class="tool" href="${safeUrl(w.url)}" target="_blank" rel="noopener">Open</a> <button class="tool rm">Remove</button></div>`).join('') : '<p>Nothing here yet. Look out for cards tagged "New in HubSpot: try it".</p>'}
  </div>`;
  art.querySelector('.a-back')!.addEventListener('click', closeArticle);
  art.querySelectorAll<HTMLElement>('.wl-item').forEach(node => {
    const item = S.work.find(x => x.id === node.dataset.id)!;
    node.querySelector('input')!.addEventListener('change', e => { item.done = (e.target as HTMLInputElement).checked; saveWork(); });
    node.querySelector('.rm')!.addEventListener('click', () => { S.work = S.work.filter(x => x !== item); saveWork(); node.remove(); });
  });
  art.scrollTop = 0; requestAnimationFrame(() => art.classList.add('open'));
}

export function closeArticle() { art.style.transition = ''; art.style.transform = ''; art.classList.remove('open'); }

/* Pull down at the top, or swipe right, to go back to the feed */
let g: { x: number; y: number; top: boolean; mode: 'x' | 'y' | 'none' | null; d?: number } | null = null;
art.addEventListener('touchstart', e => { const t = e.touches[0]; g = { x: t.clientX, y: t.clientY, top: art.scrollTop <= 0, mode: null }; }, { passive: true });
art.addEventListener('touchmove', e => {
  if (!g) return; const t = e.touches[0]; const dx = t.clientX - g.x, dy = t.clientY - g.y;
  if (!g.mode) { if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) && dx > 0) g.mode = 'x'; else if (g.top && dy > 12 && Math.abs(dy) > Math.abs(dx)) g.mode = 'y'; else if (Math.abs(dy) > 12 || Math.abs(dx) > 12) g.mode = 'none'; }
  if (g.mode === 'x') { g.d = Math.max(0, dx); art.style.transition = 'none'; art.style.transform = `translateX(${g.d}px)`; }
  if (g.mode === 'y') { g.d = Math.max(0, dy) * 0.6; art.style.transition = 'none'; art.style.transform = `translateY(${g.d}px) scale(${1 - g.d / 2000})`; }
}, { passive: true });
art.addEventListener('touchend', () => {
  if (g && (g.mode === 'x' || g.mode === 'y')) { art.style.transition = ''; if ((g.d || 0) > 90) closeArticle(); else art.style.transform = ''; }
  g = null;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeArticle(); });
