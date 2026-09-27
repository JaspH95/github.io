/* Skill of the day: the official ESCO description, plus the closest Wikipedia article for background.
   GET /api/skill?id=<ESCO skill id> */

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
/* A Wikipedia page's summary: live text, photo and link */
async function wikiSummary(title: string) {
  const s = await getJSON<any>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`);
  if (!s?.extract || s.type === 'disambiguation') return null;
  return {
    title: s.titles?.normalized || s.title, description: s.description as string | undefined, extract: s.extract as string,
    image: (s.originalimage?.width <= 1600 ? s.originalimage?.source : s.thumbnail?.source?.replace(/\/\d+px-/, '/1080px-')) as string | undefined,
    url: s.content_urls?.desktop?.page as string,
  };
}

const simple = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'bad id' }, 86400, 400);
  const uri = `http://data.europa.eu/esco/skill/${id}`;
  try {
    const s = await getJSON<any>(`https://ec.europa.eu/esco/api/resource/skill?uri=${encodeURIComponent(uri)}&language=en`);
    const label: string = s.preferredLabel?.en || s.title;
    const description: string = s.description?.en?.literal || s.definition?.en?.literal || '';
    // Background from Wikipedia, only when the page is plainly about the skill
    let wiki = null;
    try {
      const hits = (await getJSON<any>(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(label)}&limit=3`)).pages || [];
      const words = simple(label).split(' ').filter(w => w.length > 3);
      const good = hits.find((p: any) => words.length && words.filter(w => simple(p.title + ' ' + (p.description || '')).includes(w)).length / words.length >= 0.5);
      if (good) wiki = await wikiSummary(good.title);
    } catch { /* background is optional */ }
    return json({ id, label, description, url: `https://esco.ec.europa.eu/en/classification/skill?uri=${encodeURIComponent(uri)}`, wiki }, 30 * 86400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 600, 502);
  }
}
