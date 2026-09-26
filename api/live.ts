/* Live football via API-Football (free plan: 100 requests a day). The key stays on the server.
   GET /api/live?team=West%20Ham   -> next and last fixture (cached 12 hours at the edge)
   GET /api/live?fixture=123456    -> one fixture with score and events (cached 2 minutes) */

const API = 'https://v3.football.api-sports.io';

/* API-Football team IDs for the clubs offered in onboarding; anything else is looked up by name */
const TEAM_IDS: Record<string, number> = {
  Arsenal: 42, 'Aston Villa': 66, Chelsea: 49, Everton: 45, Liverpool: 40, 'Man City': 50,
  'Man United': 33, Newcastle: 34, Spurs: 47, 'West Ham': 48, Celtic: 247, Rangers: 257,
};

async function call(path: string, key: string): Promise<any[]> {
  const res = await fetch(`${API}/${path}`, { headers: { 'x-apisports-key': key }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const data: any = await res.json();
  if (data.errors && Object.keys(data.errors).length) throw new Error(`API-Football: ${JSON.stringify(data.errors)}`);
  return data.response || [];
}

function fixture(f: any) {
  return {
    id: f.fixture.id,
    kickoff: f.fixture.date,
    status: f.fixture.status.short,
    statusLong: f.fixture.status.long,
    elapsed: f.fixture.status.elapsed,
    league: f.league?.name,
    round: f.league?.round,
    home: { id: f.teams.home.id, name: f.teams.home.name },
    away: { id: f.teams.away.id, name: f.teams.away.name },
    score: { home: f.goals.home, away: f.goals.away },
    events: (f.events || []).map((e: any) => ({
      min: e.time?.elapsed, extra: e.time?.extra, team: e.team?.name, player: e.player?.name, type: e.type, detail: e.detail,
    })),
  };
}

const json = (body: unknown, maxAge: number, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${Math.min(maxAge, 60)}`,
    },
  });

export async function GET(request: Request): Promise<Response> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return json({ error: 'not configured' }, 3600, 503);
  const u = new URL(request.url);
  try {
    const fx = u.searchParams.get('fixture');
    if (fx) {
      if (!/^\d{1,10}$/.test(fx)) return json({ error: 'bad fixture' }, 3600, 400);
      const [f] = await call(`fixtures?id=${fx}`, key);
      return f ? json({ fixture: fixture(f) }, 120) : json({ error: 'not found' }, 300, 404);
    }
    const team = (u.searchParams.get('team') || '').trim();
    if (!team || team.length > 40 || !/^[\p{L}\p{N} .&'-]+$/u.test(team)) return json({ error: 'bad team' }, 3600, 400);
    let id = TEAM_IDS[team];
    let name = team;
    if (!id) {
      const [t] = await call(`teams?search=${encodeURIComponent(team.replace(/[^\p{L}\p{N} ]/gu, ''))}`, key);
      if (!t) return json({ team: null }, 86400);
      id = t.team.id; name = t.team.name;
    }
    const [next] = await call(`fixtures?team=${id}&next=1`, key);
    const [last] = await call(`fixtures?team=${id}&last=1`, key);
    return json({ team: { id, name }, next: next ? fixture(next) : null, last: last ? fixture(last) : null }, 43200);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 120, 502);
  }
}
