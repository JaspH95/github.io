/* Turns anything typed in onboarding ("rewilding", "Ancient Rome") into followable interests:
   Guardian keyword tags for news, Wikipedia pages for learning.
   GET /api/interest-search?q=rewilding */

/* Helpers are inlined: Vercel compiles each function on its own */
const UA = 'Knowfeed/1.0 (news and learning reader; contact: jasperhayward@me.com)';
const json = (body: unknown, maxAge: number, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${Math.min(maxAge, 300)}, s-maxage=${maxAge}, stale-while-revalidate=${Math.min(maxAge, 86400)}`,
    },
  });
async function getJSON<T = any>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
  return res.json() as Promise<T>;
}
const clean = (s: unknown, max = 80) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

interface Result { label: string; guardian?: string; section?: string; wiki?: string; desc?: string; image?: string }

export async function GET(request: Request): Promise<Response> {
  const q = clean(new URL(request.url).searchParams.get('q'), 60);
  if (q.length < 2) return json({ results: [] }, 3600);
  const key = process.env.GUARDIAN_API_KEY;
  const [tags, wiki] = await Promise.all([
    key ? getJSON<any>(`https://content.guardianapis.com/tags?q=${encodeURIComponent(q)}&type=keyword&page-size=6&api-key=${key}`).then(r => r.response?.results || []).catch(() => []) : Promise.resolve([]),
    getJSON<any>(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=5`).then(r => r.pages || []).catch(() => []),
  ]);
  const results: Result[] = [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const t of tags as any[]) results.push({ label: t.webTitle, guardian: t.id, section: t.sectionName });
  for (const p of wiki as any[]) {
    if (/\(disambiguation\)$/i.test(p.title) || /may refer to/i.test(p.description || '')) continue;
    const same = results.find(r => norm(r.label) === norm(p.title));
    const extra = { wiki: p.title as string, ...(p.description ? { desc: p.description as string } : {}), ...(p.thumbnail?.url ? { image: 'https:' + String(p.thumbnail.url).replace(/^https?:/, '') } : {}) };
    if (same) Object.assign(same, extra); else results.push({ label: p.title, ...extra });
  }
  // Closest to what was typed first
  const nq = norm(q);
  results.sort((a, b) => (norm(b.label) === nq ? 1 : 0) - (norm(a.label) === nq ? 1 : 0) || (b.guardian && b.wiki ? 1 : 0) - (a.guardian && a.wiki ? 1 : 0));
  return json({ results: results.slice(0, 8) }, 86400);
}
