/* The hidden developer menu: tap the Knowfeed wordmark 5 times.
   Switch editions, fake the time of day (to test catch-up), reset things, and see where images came from. */
import { S, persist, setFakeTime, faking, now, remove, ymd } from './state';
import { openSheet, closeSheet, esc, toast } from './ui';
import { forget, SLOTS, SLOT_LABEL } from './edition';
import { data } from './data';
import { startOnboarding } from './chat';
import * as srs from './srs';
import { events } from './events';
import { edition } from './feed';
import { showDrafts, setShowDrafts, reloadSeries } from './series';

let taps: number[] = [];
let onRebuild: () => void = () => {};
export const onDevRebuild = (fn: () => void) => { onRebuild = fn; };

function menu() {
  const p = S.profile;
  const st = data.status;
  const fails = st?.sources.filter(s => !s.ok) || [];
  const times: Record<string, string> = { morning: p?.editions.morning.time || '07:00', midday: p?.editions.midday.time || '12:30', evening: p?.editions.evening.time || '18:00' };
  const s = openSheet(`<div class="dev">
    <h3>Developer menu</h3>
    <p class="dnote">Now: ${esc(now().toLocaleString('en-GB'))}${faking() ? ' (faked)' : ''}</p>
    <p class="kicker small">Jump to an edition</p>
    <div class="chips">${SLOTS.map(sl => `<button class="chip-btn" data-slot="${sl}">${SLOT_LABEL[sl]}</button>`).join('')}</div>
    <p class="kicker small">Fake the time of day</p>
    <div class="drow"><input type="time" id="devTime" value="${now().toTimeString().slice(0, 5)}"><button class="chip-btn" id="devSet">Set</button><button class="chip-btn" id="devReal">Real time</button></div>
    <p class="kicker small">Reset</p>
    <div class="chips">
      <button class="chip-btn" id="devRebuild">Rebuild this edition</button>
      <button class="chip-btn" id="devEditions">Forget all editions (test catch-up)</button>
      <button class="chip-btn" id="devLikes">Clear likes and saves</button>
      <button class="chip-btn" id="devSrs">Clear learning progress</button>
      <button class="chip-btn" id="devOnb">Reset onboarding</button>
    </div>
    <p class="kicker small">Series</p>
    <div class="chips"><button class="chip-btn" id="devSeries" aria-pressed="${showDrafts()}">Show Series drafts for review</button><button class="chip-btn" id="devSeriesReset">Reset Series progress</button></div>
    <p class="kicker small">Look</p>
    <div class="chips"><button class="chip-btn" id="devImg" aria-pressed="${document.body.classList.contains('show-src')}">Show image sources</button><button class="chip-btn" id="devNotif">Test notification</button></div>
    <p class="kicker small">Data</p>
    <p class="dnote">News built ${esc(data.news?.generated ? new Date(data.news.generated).toLocaleString('en-GB') : 'never')} · ${data.news?.stories.length || 0} stories · ${data.news?.stories.filter(s => s.summary).length || 0} with AI summaries<br>
    Sources: ${st ? `${st.sources.length - fails.length}/${st.sources.length} OK` : 'unknown'}${fails.length ? ` · failing: ${esc(fails.map(f => f.name).join(', '))}` : ''}<br>
    Summaries last run: ${st ? `${st.summaries.made} made, ${st.summaries.failed} failed${st.summaries.model ? `, ${esc(st.summaries.model)}` : ''}` : '–'}<br>
    Images: ${esc(JSON.stringify(st?.images || {}))}<br>Events logged on this phone: ${events().length}</p>
  </div>`, 'Developer menu');
  s.querySelectorAll<HTMLElement>('[data-slot]').forEach(b => b.addEventListener('click', () => {
    const [h, m] = times[b.dataset.slot!].split(':').map(Number);
    const d = new Date(); d.setHours(h, m + 5, 0, 0);
    setFakeTime(d); forget(`${ymd(d)}:${b.dataset.slot}`); closeSheet(); onRebuild(); toast(`${SLOT_LABEL[b.dataset.slot as 'morning']} (time faked)`);
  }));
  s.querySelector('#devSet')!.addEventListener('click', () => {
    const v = (s.querySelector('#devTime') as HTMLInputElement).value; if (!v) return;
    const [h, m] = v.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0);
    setFakeTime(d); closeSheet(); onRebuild(); toast(`Time set to ${v}`);
  });
  s.querySelector('#devReal')!.addEventListener('click', () => { setFakeTime(null); closeSheet(); onRebuild(); toast('Real time'); });
  s.querySelector('#devRebuild')!.addEventListener('click', () => { const e = Object.keys(JSON.parse(localStorage.getItem('kf2-editions') || '{}')).sort().pop(); if (e) forget(e); closeSheet(); onRebuild(); toast('Rebuilt'); });
  s.querySelector('#devEditions')!.addEventListener('click', () => { forget(); closeSheet(); onRebuild(); toast('Editions forgotten'); });
  s.querySelector('#devLikes')!.addEventListener('click', () => { S.liked.clear(); S.saved = []; persist.liked(); persist.saved(); closeSheet(); onRebuild(); toast('Likes and saves cleared'); });
  s.querySelector('#devSrs')!.addEventListener('click', () => { srs.clearAll(); remove('pod'); closeSheet(); toast('Learning progress cleared'); setTimeout(() => location.reload(), 600); });
  s.querySelector('#devOnb')!.addEventListener('click', () => { S.profile = null; persist.profile(); forget(); closeSheet(); startOnboarding(); });
  s.querySelector('#devImg')!.addEventListener('click', e => { const on = document.body.classList.toggle('show-src'); (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(on)); });
  s.querySelector('#devNotif')!.addEventListener('click', testNotification);
  s.querySelector('#devSeries')!.addEventListener('click', e => { const on = !showDrafts(); setShowDrafts(on); (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(on)); forget(); closeSheet(); onRebuild(); toast(on ? 'Series drafts shown (only on this phone)' : 'Series drafts hidden'); });
  s.querySelector('#devSeriesReset')!.addEventListener('click', () => { remove('series'); reloadSeries(); forget(); closeSheet(); onRebuild(); toast('Series progress reset'); });
}

/* Push notifications need accounts (phase 2); this checks the phone can show one */
async function testNotification() {
  if (!('Notification' in window)) { toast("This browser can't show notifications. On iPhone, add Knowfeed to your Home Screen first"); return; }
  const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (perm !== 'granted') { toast('Notifications are turned off for Knowfeed'); return; }
  const reg = await navigator.serviceWorker?.getRegistration();
  const e = edition;
  const n = e ? e.cards.filter(c => c.kind === 'story').length : 0;
  const body = e ? `Your ${SLOT_LABEL[e.slot].toLowerCase()}: ${n} stories · about ${Math.max(2, Math.round(e.cards.length * 0.4))} minutes. (Test notification)` : 'Knowfeed can show notifications on this phone. (Test notification)';
  if (reg) reg.showNotification('Knowfeed', { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' });
  else new Notification('Knowfeed', { body });
}

export function initDev() {
  document.getElementById('wordmark')!.addEventListener('click', () => {
    const t = Date.now();
    taps = [...taps.filter(x => t - x < 2500), t];
    if (taps.length >= 5) { taps = []; menu(); }
  });
}
