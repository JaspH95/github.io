/* Live football and the Tube. Both go through our own serverless functions, which hold the keys and cache the answers. */
import { S, load, save, today } from './state';
import { activeTopics, type Card, type Match, type TflLine } from './cards';
import { pinTop, unpin } from './feed';

const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']);
const DONE = new Set(['FT', 'AET', 'PEN']);
const POLL_MS = 150_000; // every 2.5 minutes, only while a followed team is playing

interface FixtureCache { date: string; teams: Record<string, { next: Match | null; last: Match | null }> }

async function api<T>(path: string): Promise<T | null> {
  try { const r = await fetch(path); if (!r.ok) return null; return await r.json(); } catch { return null; }
}

/* Fixtures: once a day per followed team */
async function fixtures(): Promise<FixtureCache> {
  let cache = load<FixtureCache>('kf-fixtures', { date: '', teams: {} });
  const teams = S.profile?.teams || [];
  if (cache.date !== today()) cache = { date: today(), teams: {} };
  for (const team of teams) {
    if (cache.teams[team]) continue;
    const r = await api<{ next: Match | null; last: Match | null }>(`/api/live?team=${encodeURIComponent(team)}`);
    if (r) cache.teams[team] = { next: r.next, last: r.last };
  }
  save('kf-fixtures', cache);
  return cache;
}

const matchCard = (m: Match, team: string): Card => ({ id: `match-${m.id}`, type: LIVE.has(m.status) ? 'live' : 'result', t: 'sport', tag: LIVE.has(m.status) ? 'Matchday' : 'Result', match: m, team });

let timer: ReturnType<typeof setTimeout> | null = null;
let watching: { m: Match; team: string } | null = null;

async function poll() {
  if (!watching) return;
  if (document.hidden) { timer = setTimeout(poll, POLL_MS); return; }
  const r = await api<{ fixture: Match }>(`/api/live?fixture=${watching.m.id}`);
  const m = r?.fixture;
  if (m) {
    watching.m = m;
    if (LIVE.has(m.status) || DONE.has(m.status)) pinTop(matchCard(m, watching.team), 1);
    if (DONE.has(m.status)) {
      // Full time: it becomes a result card. Keep the result for later today.
      const cache = load<FixtureCache>('kf-fixtures', { date: today(), teams: {} });
      if (cache.teams[watching.team]) { cache.teams[watching.team].last = m; cache.teams[watching.team].next = null; save('kf-fixtures', cache); }
      watching = null; return;
    }
    if (['PST', 'CANC', 'ABD'].includes(m.status)) { unpin(`match-${m.id}`); watching = null; return; }
  }
  // Stop once we're well past the end of the match window
  if (+new Date(watching.m.kickoff) + 3.5 * 3600_000 < Date.now()) { watching = null; return; }
  timer = setTimeout(poll, POLL_MS);
}

export async function startLive() {
  if (timer) { clearTimeout(timer); timer = null; }
  watching = null;
  if (!activeTopics().has('sport') || !S.profile?.teams?.length) return;
  const cache = await fixtures();
  const now = Date.now();
  for (const [team, f] of Object.entries(cache.teams)) {
    // A result from the last day shows as a result card
    if (f.last && DONE.has(f.last.status) && now - +new Date(f.last.kickoff) < 30 * 3600_000) pinTop(matchCard(f.last, team), 1);
    const m = f.next;
    if (!m || watching) continue;
    const ko = +new Date(m.kickoff);
    if (now >= ko - 60_000 && now < ko + 3.5 * 3600_000) { watching = { m, team }; poll(); }
    else if (ko > now && ko - now < 12 * 3600_000) {
      // Kick-off later today: start polling at kick-off if the app is still open
      timer = setTimeout(() => { watching = { m, team }; poll(); }, ko - now);
    }
  }
}

/* London: a card only when a line has disruption */
export async function startTfl() {
  unpin('tfl');
  if (S.profile?.place !== 'London' || !activeTopics().has('local')) return;
  const r = await api<{ disrupted: TflLine[] }>('/api/tfl');
  if (r?.disrupted?.length) pinTop({ id: 'tfl', type: 'tfl', t: 'local', tag: 'London', tfl: r.disrupted }, 2);
}
