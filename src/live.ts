/* Live football: a slim banner at the top only while one of your teams is playing.
   Fixtures are fetched once a day; scores are polled every 2.5 minutes during the match,
   through our own serverless function, which holds the key and caches answers for 2 minutes. */
import { S, load, save, today } from './state';
import { esc, openSheet } from './ui';

export interface Match {
  id: number; kickoff: string; status: string; statusLong: string; elapsed: number | null; league?: string; round?: string;
  home: { id: number; name: string }; away: { id: number; name: string }; score: { home: number | null; away: number | null };
  events: { min?: number; extra?: number; team?: string; player?: string; type?: string; detail?: string }[];
}
const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']);
const DONE = new Set(['FT', 'AET', 'PEN']);
const POLL_MS = 150_000;

interface Fixtures { date: string; teams: Record<string, { next: Match | null; last: Match | null }> }

async function api<T>(path: string): Promise<T | null> {
  try { const r = await fetch(path); if (!r.ok) return null; return await r.json(); } catch { return null; }
}

async function fixtures(): Promise<Fixtures> {
  let cache = load<Fixtures>('fixtures', { date: '', teams: {} });
  if (cache.date !== today()) cache = { date: today(), teams: {} };
  for (const team of S.profile?.teams || []) {
    if (cache.teams[team]) continue;
    const r = await api<{ next: Match | null; last: Match | null }>(`/api/live?team=${encodeURIComponent(team)}`);
    if (r) cache.teams[team] = { next: r.next, last: r.last };
  }
  save('fixtures', cache);
  return cache;
}
/* For the sports page: the latest result and next fixture, if we have them */
export function fixtureLines(team: string): string[] {
  const f = load<Fixtures>('fixtures', { date: '', teams: {} }).teams[team];
  if (!f) return [];
  const out: string[] = [];
  if (f.last && DONE.has(f.last.status)) out.push(`${f.last.home.name} ${f.last.score.home}–${f.last.score.away} ${f.last.away.name} (FT)`);
  if (f.next) out.push(`Next: ${new Date(f.next.kickoff).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} v ${f.next.home.name === team || f.next.home.name.includes(team) ? f.next.away.name : f.next.home.name}`);
  return out;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let watching: Match | null = null;

function banner(m: Match | null) {
  const b = document.getElementById('live')!;
  if (!m) { b.hidden = true; return; }
  const live = LIVE.has(m.status);
  const clock = live ? (m.status === 'HT' ? 'HT' : m.elapsed != null ? `${m.elapsed}'` : m.status) : 'FT';
  b.hidden = false;
  b.innerHTML = `<button class="lb glass"><span class="dot ${live ? '' : 'ft'}"></span><span class="clk">${esc(clock)}</span><span class="sc">${esc(m.home.name)} <b>${m.score.home ?? 0}–${m.score.away ?? 0}</b> ${esc(m.away.name)}</span></button>`;
  b.querySelector('button')!.addEventListener('click', () => details(m));
}

function details(m: Match) {
  const ev = m.events.filter(e => e.type === 'Goal' || e.type === 'Card' || e.type === 'subst').slice(-12).reverse();
  openSheet(`<div class="match"><p class="kicker">${esc(m.league || '')}${m.round ? ' · ' + esc(m.round) : ''}</p><h3>${esc(m.home.name)} ${m.score.home ?? 0}–${m.score.away ?? 0} ${esc(m.away.name)}</h3><p>${esc(m.statusLong)}</p>
    ${ev.length ? `<ul class="events">${ev.map(e => `<li><b>${e.min ?? ''}${e.extra ? '+' + e.extra : ''}'</b> ${esc(e.type === 'Goal' ? (e.detail === 'Own Goal' ? 'Own goal' : 'Goal') : e.type === 'subst' ? 'Substitution' : e.detail || '')}: ${esc(e.player || '')} (${esc(e.team || '')})</li>`).join('')}</ul>` : ''}
    <p class="attrib-s">Live data from API-Football</p></div>`, 'Live match');
}

async function poll() {
  if (!watching) return;
  if (document.hidden) { timer = setTimeout(poll, POLL_MS); return; }
  const r = await api<{ fixture: Match }>(`/api/live?fixture=${watching.id}`);
  const m = r?.fixture;
  if (m) {
    watching = m;
    if (LIVE.has(m.status)) banner(m);
    if (DONE.has(m.status)) {
      // Full time: the banner goes; the result shows on the sports page
      const c = load<Fixtures>('fixtures', { date: today(), teams: {} });
      for (const t of Object.values(c.teams)) if (t.next?.id === m.id) { t.last = m; t.next = null; }
      save('fixtures', c);
      banner(null); watching = null; return;
    }
    if (['PST', 'CANC', 'ABD'].includes(m.status)) { banner(null); watching = null; return; }
  }
  if (+new Date(watching.kickoff) + 3.5 * 3600_000 < Date.now()) { banner(null); watching = null; return; }
  timer = setTimeout(poll, POLL_MS);
}

export async function startLive() {
  if (timer) { clearTimeout(timer); timer = null; }
  watching = null; banner(null);
  if (!S.profile?.teams?.length) return;
  const cache = await fixtures();
  const t = Date.now();
  for (const f of Object.values(cache.teams)) {
    const m = f.next;
    if (!m || watching) continue;
    const ko = +new Date(m.kickoff);
    if (t >= ko - 60_000 && t < ko + 3.5 * 3600_000) { watching = m; poll(); }
    else if (ko > t && ko - t < 12 * 3600_000) timer = setTimeout(() => { watching = m; poll(); }, ko - t);
  }
}
