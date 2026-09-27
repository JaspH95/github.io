/* Live news from outlets' own public RSS feeds: headlines, a line of summary, a picture and a link to the original.
   Nothing is stored; responses are cached at Vercel's edge so every tester shares one fetch.
     GET /api/news?mode=outlet&id=theverge        an outlet's latest
     GET /api/news?mode=breaking&region=uk        the big headlines right now (uk, us, ie, au, world)
     GET /api/news?mode=search&q=iphone&region=uk  any topic, across outlets (Google News search, plus the Guardian)
   The app imports OUTLETS from here too, so the list lives in one place. */

export type Region = 'uk' | 'us' | 'ie' | 'au' | 'world';
export type OutletKind = 'news' | 'tech' | 'business' | 'science' | 'sport' | 'culture';
export interface Outlet {
  id: string;
  name: string;
  region: Region;
  kind: OutletKind;
  feed: string;
  breaking?: boolean;   // its front page feed is used for breaking news in its region
  paywall?: boolean;    // headlines only; the article may need a subscription
}

export const OUTLETS: Outlet[] = [
  // UK
  { id: 'bbc', name: 'BBC News', region: 'uk', kind: 'news', feed: 'https://feeds.bbci.co.uk/news/rss.xml', breaking: true },
  { id: 'sky', name: 'Sky News', region: 'uk', kind: 'news', feed: 'https://feeds.skynews.com/feeds/rss/home.xml', breaking: true },
  { id: 'guardian', name: 'The Guardian', region: 'uk', kind: 'news', feed: 'https://www.theguardian.com/uk/rss', breaking: true },
  { id: 'independent', name: 'The Independent', region: 'uk', kind: 'news', feed: 'https://www.independent.co.uk/news/uk/rss', breaking: true },
  { id: 'telegraph', name: 'The Telegraph', region: 'uk', kind: 'news', feed: 'https://www.telegraph.co.uk/rss.xml', paywall: true },
  { id: 'standard', name: 'Evening Standard', region: 'uk', kind: 'news', feed: 'https://www.standard.co.uk/rss' },
  { id: 'inews', name: 'i', region: 'uk', kind: 'news', feed: 'https://inews.co.uk/feed' },
  { id: 'ft', name: 'Financial Times', region: 'uk', kind: 'business', feed: 'https://www.ft.com/rss/home', paywall: true },
  { id: 'economist', name: 'The Economist', region: 'uk', kind: 'business', feed: 'https://www.economist.com/latest/rss.xml', paywall: true },
  { id: 'bbcbusiness', name: 'BBC Business', region: 'uk', kind: 'business', feed: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { id: 'skysports', name: 'Sky Sports', region: 'uk', kind: 'sport', feed: 'https://www.skysports.com/rss/12040' },
  { id: 'bbcsport', name: 'BBC Sport', region: 'uk', kind: 'sport', feed: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  // Ireland and Australia
  { id: 'rte', name: 'RTÉ News', region: 'ie', kind: 'news', feed: 'https://www.rte.ie/feeds/rss/?index=/news/', breaking: true },
  { id: 'irishtimes', name: 'The Irish Times', region: 'ie', kind: 'news', feed: 'https://www.irishtimes.com/arc/outboundfeeds/feed-irish-news/?outputType=xml', breaking: true, paywall: true },
  { id: 'abcau', name: 'ABC News (Australia)', region: 'au', kind: 'news', feed: 'https://www.abc.net.au/news/feed/51120/rss.xml', breaking: true },
  { id: 'guardianau', name: 'Guardian Australia', region: 'au', kind: 'news', feed: 'https://www.theguardian.com/australia-news/rss', breaking: true },
  // US
  { id: 'npr', name: 'NPR', region: 'us', kind: 'news', feed: 'https://feeds.npr.org/1001/rss.xml', breaking: true },
  { id: 'nyt', name: 'The New York Times', region: 'us', kind: 'news', feed: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', breaking: true, paywall: true },
  { id: 'wapo', name: 'The Washington Post', region: 'us', kind: 'news', feed: 'https://feeds.washingtonpost.com/rss/national', breaking: true, paywall: true },
  { id: 'cbs', name: 'CBS News', region: 'us', kind: 'news', feed: 'https://www.cbsnews.com/latest/rss/main', breaking: true },
  { id: 'cnbc', name: 'CNBC', region: 'us', kind: 'business', feed: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  // International
  { id: 'bbcworld', name: 'BBC World', region: 'world', kind: 'news', feed: 'https://feeds.bbci.co.uk/news/world/rss.xml', breaking: true },
  { id: 'aljazeera', name: 'Al Jazeera', region: 'world', kind: 'news', feed: 'https://www.aljazeera.com/xml/rss/all.xml', breaking: true },
  { id: 'dw', name: 'DW', region: 'world', kind: 'news', feed: 'https://rss.dw.com/rdf/rss-en-all', breaking: true },
  { id: 'france24', name: 'France 24', region: 'world', kind: 'news', feed: 'https://www.france24.com/en/rss' },
  { id: 'euronews', name: 'Euronews', region: 'world', kind: 'news', feed: 'https://www.euronews.com/rss' },
  { id: 'politico', name: 'Politico Europe', region: 'world', kind: 'news', feed: 'https://www.politico.eu/feed/' },
  // Tech
  { id: 'theverge', name: 'The Verge', region: 'world', kind: 'tech', feed: 'https://www.theverge.com/rss/index.xml' },
  { id: 'techcrunch', name: 'TechCrunch', region: 'world', kind: 'tech', feed: 'https://techcrunch.com/feed/' },
  { id: 'wired', name: 'Wired', region: 'world', kind: 'tech', feed: 'https://www.wired.com/feed/rss' },
  { id: 'arstechnica', name: 'Ars Technica', region: 'world', kind: 'tech', feed: 'https://feeds.arstechnica.com/arstechnica/index' },
  { id: 'engadget', name: 'Engadget', region: 'world', kind: 'tech', feed: 'https://www.engadget.com/rss.xml' },
  { id: '9to5mac', name: '9to5Mac', region: 'world', kind: 'tech', feed: 'https://9to5mac.com/feed/' },
  { id: 'macrumors', name: 'MacRumors', region: 'world', kind: 'tech', feed: 'https://feeds.macrumors.com/MacRumors-All' },
  { id: '9to5google', name: '9to5Google', region: 'world', kind: 'tech', feed: 'https://9to5google.com/feed/' },
  { id: 'androidauthority', name: 'Android Authority', region: 'world', kind: 'tech', feed: 'https://www.androidauthority.com/feed/' },
  { id: 'theregister', name: 'The Register', region: 'uk', kind: 'tech', feed: 'https://www.theregister.com/headlines.atom' },
  { id: 'tomshardware', name: "Tom's Hardware", region: 'world', kind: 'tech', feed: 'https://www.tomshardware.com/feeds/all' },
  { id: 'techradar', name: 'TechRadar', region: 'world', kind: 'tech', feed: 'https://www.techradar.com/rss' },
  { id: 'gizmodo', name: 'Gizmodo', region: 'world', kind: 'tech', feed: 'https://gizmodo.com/feed' },
  { id: 'mittr', name: 'MIT Technology Review', region: 'world', kind: 'tech', feed: 'https://www.technologyreview.com/feed/' },
  { id: 'restofworld', name: 'Rest of World', region: 'world', kind: 'tech', feed: 'https://restofworld.org/feed/latest/' },
  { id: '404media', name: '404 Media', region: 'world', kind: 'tech', feed: 'https://www.404media.co/rss/' },
  { id: 'hackernews', name: 'Hacker News', region: 'world', kind: 'tech', feed: 'https://hnrss.org/frontpage' },
  { id: 'bbctech', name: 'BBC Technology', region: 'uk', kind: 'tech', feed: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { id: 'guardiantech', name: 'Guardian Technology', region: 'uk', kind: 'tech', feed: 'https://www.theguardian.com/uk/technology/rss' },
  // Science
  { id: 'newscientist', name: 'New Scientist', region: 'uk', kind: 'science', feed: 'https://www.newscientist.com/feed/home/' },
  { id: 'nature', name: 'Nature', region: 'world', kind: 'science', feed: 'https://www.nature.com/nature.rss' },
  { id: 'livescience', name: 'Live Science', region: 'world', kind: 'science', feed: 'https://www.livescience.com/feeds/all' },
  { id: 'sciencedaily', name: 'ScienceDaily', region: 'world', kind: 'science', feed: 'https://www.sciencedaily.com/rss/all.xml' },
  { id: 'nasa', name: 'NASA', region: 'world', kind: 'science', feed: 'https://www.nasa.gov/news-release/feed/' },
  { id: 'bbcscience', name: 'BBC Science', region: 'uk', kind: 'science', feed: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  // Culture
  { id: 'bbcarts', name: 'BBC Entertainment & Arts', region: 'uk', kind: 'culture', feed: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  { id: 'guardianculture', name: 'Guardian Culture', region: 'uk', kind: 'culture', feed: 'https://www.theguardian.com/uk/culture/rss' },
];

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  outlet: string;
  outletId?: string;
  published: string;
  image?: string;
  outlets?: string[];   // breaking: every outlet leading with it
  paywall?: boolean;
}

/* ---------- Helpers (inlined: Vercel compiles each function on its own) ---------- */

const UA = 'Knowfeed/1.0 (news and learning reader; contact: jasperhayward@me.com)';
const json = (body: unknown, maxAge: number, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${Math.min(maxAge, 120)}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}` },
  });

const ENT: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&#8217;': '’', '&#8216;': '‘', '&#8220;': '“', '&#8221;': '”', '&#8211;': '–', '&#8212;': '—', '&#038;': '&' };
const decode = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => ENT[m] ?? String.fromCodePoint(+d)).replace(/&[a-z]+;/gi, m => ENT[m.toLowerCase()] ?? ' ');
const cdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const text = (s: string) => decode(cdata(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1) > n * 0.6 ? s.lastIndexOf(' ', n - 1) : n - 1) + '…');
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))?.[1];
const attr = (block: string, el: string, a: string) => block.match(new RegExp(`<${el}\\b[^>]*\\b${a}=["']([^"']+)["']`, 'i'))?.[1];
const hashId = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'n' + (h >>> 0).toString(36); };
/* Atom: the rel="alternate" link (or one with no rel) */
const atomLink = (b: string) => { const links = [...b.matchAll(/<link\b([^>]*?)\/?>/gi)].map(m => m[1]); const alt = links.find(a => /rel=["']alternate/i.test(a)) || links.find(a => !/rel=/i.test(a)); return alt?.match(/href=["']([^"']+)/i)?.[1]; };
const safeHttp = (u?: string) => (u && /^https?:\/\//i.test(u) ? decode(u).replace(/^http:/i, 'https:') : undefined);

export function parseFeed(xml: string, outlet: string, outletId?: string): NewsItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const out: NewsItem[] = [];
  for (const b of blocks.slice(0, 40)) {
    const title = text(tag(b, 'title') || '');
    const link = safeHttp(text(tag(b, 'link') || '') || atomLink(b) || text(tag(b, 'guid') || ''));
    if (!title || !link) continue;
    const rawDesc = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content') || tag(b, 'content:encoded') || '';
    const when = text(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date') || '');
    const t = when ? new Date(when) : null;
    const img = safeHttp(attr(b, 'media:content', 'url') || attr(b, 'media:thumbnail', 'url') || (/image\//i.test(attr(b, 'enclosure', 'type') || '') ? attr(b, 'enclosure', 'url') : undefined) || cdata(rawDesc + (tag(b, 'content:encoded') || '')).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]);
    const summary = clip(text(rawDesc).replace(/^(Article URL|Comments URL|Points|# Comments):.*$/gim, '').trim(), 260);
    out.push({
      id: hashId(link), title: clip(title, 200), summary: /^(Comments|Article URL)/.test(summary) ? '' : summary, url: link, outlet: text(tag(b, 'source') || '') || outlet, ...(outletId ? { outletId } : {}),
      published: t && !isNaN(+t) ? t.toISOString() : new Date().toISOString(), ...(img ? { image: img } : {}),
    });
  }
  return out;
}

async function getText(url: string, ms = 6000): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(ms), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
  return res.text();
}

export async function outletItems(o: Outlet): Promise<NewsItem[]> {
  const items = parseFeed(await getText(o.feed), o.name, o.id);
  return items.map(i => (o.paywall ? { ...i, paywall: true } : i)).sort((a, b) => b.published.localeCompare(a.published)).slice(0, 25);
}

/* ---------- Breaking: what several front pages lead with right now ---------- */

const STOP = new Set('a an the and or of to in on at for with by from as is are was were be been has have had it its this that after over into up out new says said say will could would can may not no amid live latest news what how why who'.split(' '));
const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
const overlap = (a: Set<string>, b: Set<string>) => { let n = 0; a.forEach(w => { if (b.has(w)) n++; }); return n / Math.max(1, Math.min(a.size, b.size)); };

export async function breaking(region: Region): Promise<NewsItem[]> {
  const sources = OUTLETS.filter(o => o.breaking && (o.region === region || (region !== 'uk' && region !== 'us' && o.region === 'world') || (region === 'uk' && o.id === 'bbcworld')));
  const lists = await Promise.allSettled(sources.map(async o => (await outletItems(o)).slice(0, 12).map((x, pos) => ({ ...x, pos }))));
  const since = Date.now() - 18 * 3600_000;
  const items = lists.flatMap(r => (r.status === 'fulfilled' ? r.value : [])).filter(x => +new Date(x.published) >= since);
  const groups: { lead: NewsItem & { pos: number }; w: Set<string>; outlets: Set<string>; score: number }[] = [];
  for (const it of items.sort((a, b) => a.pos - b.pos)) {
    const w = words(it.title);
    const g = groups.find(x => overlap(x.w, w) >= 0.5);
    if (g) { g.outlets.add(it.outlet); g.score += 3 - Math.min(2, it.pos / 4); if (!g.lead.image && it.image) g.lead = { ...g.lead, image: it.image }; }
    else groups.push({ lead: it, w, outlets: new Set([it.outlet]), score: 3 - Math.min(2, it.pos / 4) });
  }
  const fresh = (x: NewsItem) => Math.max(0, 1 - (Date.now() - +new Date(x.published)) / (12 * 3600_000));
  return groups
    .map(g => ({ ...g, score: g.score + g.outlets.size * 2 + fresh(g.lead) * 2 }))
    .sort((a, b) => b.score - a.score).slice(0, 12)
    .map(g => { const { pos: _pos, ...lead } = g.lead; return { ...lead, outlets: [...g.outlets] }; });
}

/* ---------- Search: any topic, across outlets ---------- */

const GN: Record<Region, string> = { uk: 'hl=en-GB&gl=GB&ceid=GB:en', ie: 'hl=en-IE&gl=IE&ceid=IE:en', au: 'hl=en-AU&gl=AU&ceid=AU:en', us: 'hl=en-US&gl=US&ceid=US:en', world: 'hl=en-GB&gl=GB&ceid=GB:en' };

export async function search(q: string, region: Region, days = 3): Promise<NewsItem[]> {
  const jobs: Promise<NewsItem[]>[] = [];
  // Google News search covers every outlet; its titles end " - Outlet"
  jobs.push((async () => {
    const xml = await getText(`https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:${days}d`)}&${GN[region]}`);
    return parseFeed(xml, 'Google News').map(i => {
      const src = i.title.match(/\s[-–]\s([^-–]+)$/);
      return { ...i, outlet: i.outlet === 'Google News' ? src?.[1].trim() || 'News' : i.outlet, title: src ? i.title.slice(0, src.index).trim() : i.title, summary: '' };
    });
  })());
  const key = process.env.GUARDIAN_API_KEY;
  if (key) jobs.push((async () => {
    const res = await fetch(`https://content.guardianapis.com/search?q=${encodeURIComponent(q)}&show-fields=trailText,thumbnail&page-size=10&order-by=newest&from-date=${new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)}&api-key=${key}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const r: any = await res.json();
    return (r.response?.results || []).filter((x: any) => x.type === 'article').map((x: any): NewsItem => ({
      id: hashId(x.webUrl), title: text(x.webTitle), summary: clip(text(x.fields?.trailText || ''), 260), url: x.webUrl, outlet: 'The Guardian', outletId: 'guardian',
      published: x.webPublicationDate, ...(x.fields?.thumbnail ? { image: x.fields.thumbnail } : {}),
    }));
  })());
  const all = (await Promise.allSettled(jobs)).flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  // One of each story: drop near-identical headlines
  const out: NewsItem[] = [];
  for (const it of all.sort((a, b) => b.published.localeCompare(a.published))) {
    const w = words(it.title);
    if (!out.some(o => overlap(words(o.title), w) >= 0.7)) out.push(it);
  }
  return out.slice(0, 25);
}

/* ---------- The endpoint ---------- */

const REGIONS: Region[] = ['uk', 'us', 'ie', 'au', 'world'];

export async function GET(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams;
  const mode = p.get('mode');
  const region = (REGIONS.includes(p.get('region') as Region) ? p.get('region') : 'uk') as Region;
  try {
    if (mode === 'outlet') {
      const o = OUTLETS.find(x => x.id === p.get('id'));
      if (!o) return json({ items: [], error: 'unknown outlet' }, 3600, 404);
      return json({ outlet: o.id, items: await outletItems(o) }, 600);
    }
    if (mode === 'breaking') return json({ region, items: await breaking(region) }, 300);
    if (mode === 'search') {
      const q = String(p.get('q') || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80);
      if (q.length < 2) return json({ items: [] }, 3600, 400);
      const days = Math.min(7, Math.max(1, Number(p.get('days')) || 3));
      return json({ q, items: await search(q, region, days) }, 900);
    }
    return json({ error: 'mode must be outlet, breaking or search' }, 3600, 400);
  } catch (e: any) {
    return json({ items: [], error: String(e?.message || e) }, 120, 502);
  }
}
