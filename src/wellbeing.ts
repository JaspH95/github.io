/* Wellbeing: time spent is counted while the app is on screen. After 45 minutes of continuous use there's a
   gentle check-in; an optional daily limit suggests a break; a weekly recap sits on the done screen. */
import { S, day, persist, now, ymd, addDays, today } from './state';
import { openSheet, closeSheet, plural } from './ui';
import { PACKS } from './languages';
import * as srs from './srs';

let sessionStart = Date.now();
let lastTick = Date.now();
let checkedIn = false;
let limitShown = '';

function tick() {
  if (document.hidden) return;
  const t = Date.now();
  const gap = t - lastTick;
  lastTick = t;
  // A gap of more than 5 minutes means you'd put the phone down: a new session
  if (gap > 5 * 60_000) { sessionStart = t; checkedIn = false; return; }
  day().secs += Math.round(gap / 1000);
  persist.stats();
  if (!checkedIn && t - sessionStart > 45 * 60_000) { checkedIn = true; checkIn(); }
  const lim = S.profile?.limitMin;
  if (lim && day().secs >= lim * 60 && limitShown !== today()) { limitShown = today(); limitReached(lim); }
}

function checkIn() {
  const s = openSheet(`<div class="gentle"><h3>You've been reading for a while.</h3><p>Keep going, or take a break? Everything will still be here.</p><div class="choices"><button class="cta keep">Keep going</button><button class="cta ghost brk">Take a break</button></div></div>`, 'Check-in');
  s.querySelector('.keep')!.addEventListener('click', () => { closeSheet(); sessionStart = Date.now(); checkedIn = false; });
  s.querySelector('.brk')!.addEventListener('click', () => { closeSheet(); document.getElementById('feed')!.scrollTo({ top: 0 }); });
}

function limitReached(min: number) {
  const s = openSheet(`<div class="gentle"><h3>That's your ${min} minutes for today.</h3><p>You set this limit yourself. You can keep going, or change it in settings.</p><div class="choices"><button class="cta ok">OK</button></div></div>`, 'Daily limit');
  s.querySelector('.ok')!.addEventListener('click', closeSheet);
}

/* A short recap of the last 7 days, shown on the done screen on Sundays and Mondays */
export function weekly(): string | null {
  const d = now().getDay();
  if (d !== 0 && d !== 1) return null;
  let secs = 0, read = 0, learned = 0, days = 0;
  for (let i = 0; i < 7; i++) { const s = S.stats[addDays(ymd(now()), -i)]; if (s) { secs += s.secs; read += s.read; learned += s.learned; if (s.secs > 60) days++; } }
  // Only worth a recap after a few days of use
  if (days < 3) return null;
  const mins = Math.round(secs / 60);
  const time = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : plural(mins, 'minute');
  const langs = (S.profile?.languages || []).filter(l => PACKS[l.name]).map(l => `${l.name}: ${srs.progress(l.name, PACKS[l.name]).learned} learned`);
  return `${time} reading, ${plural(read, 'story', 'stories')} read in full, ${plural(learned, 'thing')} learned.${langs.length ? ' ' + langs.join(', ') + '.' : ''}`;
}

export function goalLine(): string | null {
  const g = S.profile?.goalMin; if (!g) return null;
  const m = Math.round(day().secs / 60);
  return m >= g ? `Daily goal reached: ${m} of ${g} minutes` : `${m} of ${g} minutes today`;
}

export function initWellbeing() {
  setInterval(tick, 20_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (Date.now() - lastTick > 5 * 60_000) { sessionStart = Date.now(); checkedIn = false; } lastTick = Date.now(); } });
}
