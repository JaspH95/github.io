/* Local news for cities the hourly pipeline doesn't cover: a Guardian search for the city.
   GET /api/local?city=Lisbon */

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
const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, m => ({ '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' } as Record<string, string>)[m] ?? ' ').replace(/\s+/g, ' ').trim();

export async function GET(request: Request): Promise<Response> {
  const city = clean(new URL(request.url).searchParams.get('city'), 50);
  if (!city || !/^[\p{L}\p{N} .,'’()-]+$/u.test(city)) return json({ stories: [] }, 3600, 400);
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return json({ stories: [] }, 600);
  try {
    const r = await getJSON<any>(`https://content.guardianapis.com/search?q=${encodeURIComponent(`"${city}"`)}&show-fields=trailText,thumbnail&page-size=15&order-by=newest&from-date=${new Date(Date.now() - 4 * 86400_000).toISOString().slice(0, 10)}&api-key=${key}`);
    const stories = (r.response?.results || []).filter((x: any) => x.type === 'article').map((x: any) => ({
      id: 'gl-' + x.id.replace(/[^a-z0-9]+/gi, '-').slice(-40),
      title: strip(x.webTitle), standfirst: strip(x.fields?.trailText || ''), url: x.webUrl, outlet: 'The Guardian',
      published: x.webPublicationDate, first: x.webPublicationDate, updated: x.webPublicationDate,
      topic: 'local', tags: [], tag: city, importance: 0,
      articles: [{ outlet: 'The Guardian', url: x.webUrl, title: strip(x.webTitle), published: x.webPublicationDate }],
      ...(x.fields?.thumbnail ? { image: { url: x.fields.thumbnail, source: 'article', credit: 'The Guardian', link: x.webUrl } } : {}),
    }));
    return json({ stories }, 1800);
  } catch (e: any) {
    return json({ stories: [], error: String(e?.message || e) }, 300, 502);
  }
}
