import { fetchJSON, record, hash, clip, pool, sleep } from './util';
import { getFeed } from './rss';
import type { LearnCard, Quiz, HubItem, TopicKey, QuizArticle, Interest } from '../src/types';

/* ---------- Wikipedia ---------- */

interface WikiSummary {
  type?: string;
  title: string;
  titles?: { normalized: string };
  extract: string;
  description?: string;
  thumbnail?: { source: string; width: number };
  originalimage?: { source: string; width: number };
  content_urls?: { desktop: { page: string } };
  pop?: number;               // average daily page views over the last month: how well known it already is
}

function bestImage(s: WikiSummary): string | undefined {
  const o = s.originalimage, t = s.thumbnail;
  if (o && o.width <= 1400 && !/\.svg$/i.test(o.source)) return o.source;
  if (t) return t.source.replace(/\/\d+px-/, '/960px-');
  return undefined;
}

const titleOf = (s: WikiSummary) => s.titles?.normalized || s.title.replace(/_/g, ' ');
const pageUrl = (s: WikiSummary) => s.content_urls?.desktop.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`;

export async function wikiSummary(title: string): Promise<WikiSummary | null> {
  const t = encodeURIComponent(title.replace(/ /g, '_'));
  try {
    const s = await fetchJSON<WikiSummary>(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}?redirect=true`);
    if (s.type === 'disambiguation' || !s.extract) return null;
    return s;
  } catch {
    // Fallback: the Action API gives the same intro text and image
    try {
      const q = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts|pageimages|info&exintro=1&explaintext=1&exsentences=4&piprop=thumbnail|original&pithumbsize=960&inprop=url&titles=${t}`;
      const r = await fetchJSON<any>(q);
      const p = r?.query?.pages?.[0];
      if (!p || p.missing || !p.extract) return null;
      return {
        title: p.title, extract: p.extract,
        thumbnail: p.thumbnail ? { source: p.thumbnail.source, width: p.thumbnail.width } : undefined,
        originalimage: p.original ? { source: p.original.source, width: p.original.width } : undefined,
        content_urls: { desktop: { page: p.fullurl } },
      };
    } catch { return null; }
  }
}

/* The most surprising sentence in an intro (not the definition that opens it): numbers, firsts, records, origins.
   Taken word for word from the article, so nothing is invented. */
const HOOKY = /\b(first|only|oldest|largest|biggest|smallest|longest|tallest|fastest|highest|deepest|earliest|record|originally|named after|nicknamed|invented|discovered|despite|although|surprising|unusual|rare|banned|secret|accident|once|never|world's)\b/gi;
export function hookSentence(extract: string): string | undefined {
  const sents = extract.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z"‘“(])/).map(x => x.trim());
  let best: string | undefined, score = 1;
  sents.slice(1).forEach((x, k) => {
    if (x.length < 60 || x.length > 230 || /^(It|This|These|They|He|She|His|Her|Its|There)\b/.test(x) || /[:;]$/.test(x)) return;
    const sc = (x.match(HOOKY) || []).length * 2 + (/\d/.test(x) ? 1 : 0) - k * 0.2;
    if (sc > score) { score = sc; best = x; }
  });
  return best;
}

function wikiCard(s: WikiSummary, kind: LearnCard['kind'], topic: TopicKey, extra: Partial<LearnCard> = {}): LearnCard {
  const image = bestImage(s);
  const fact = kind === 'topic' ? hookSentence(s.extract) : undefined;
  return {
    id: `${kind}-${hash(s.title + (extra.event || ''))}`,
    kind, topic,
    title: titleOf(s),
    ...(s.description ? { description: s.description } : {}),
    extract: clip(s.extract, 900),
    ...(image ? { image } : {}),
    url: pageUrl(s),
    source: 'Wikipedia',
    ...(s.pop !== undefined ? { pop: s.pop } : {}),
    ...(fact ? { fact } : {}),
    ...extra,
  };
}

async function dailyFeed(date: Date): Promise<any | null> {
  const y = date.getUTCFullYear(), m = String(date.getUTCMonth() + 1).padStart(2, '0'), d = String(date.getUTCDate()).padStart(2, '0');
  const urls = [
    `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`,
    `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${d}`,
  ];
  for (const url of urls) {
    try {
      const f = await fetchJSON<any>(url);
      record('Wikipedia daily feed', url, true, (f.mostread?.articles?.length || 0) + (f.onthisday?.length || 0) + (f.tfa ? 1 : 0));
      return f;
    } catch (e: any) {
      record('Wikipedia daily feed', url, false, 0, e?.message);
    }
  }
  return null;
}

/* Deterministic shuffle so a day's picks are stable across hourly runs */
function seeded(seed: number) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function shuffle<T>(xs: T[], r: () => number): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const dayNum = (date: Date) => Math.floor(+date / 86400000);

export async function wikipediaDaily(date: Date): Promise<{ cards: LearnCard[]; quizzes: Quiz[] }> {
  const f = await dailyFeed(date);
  const cards: LearnCard[] = [], quizzes: Quiz[] = [];
  if (!f) return { cards, quizzes };

  if (f.tfa?.extract) cards.push(wikiCard(f.tfa, 'featured', 'general'));

  const skip = /^(Main_Page|Special:|Wikipedia:|Portal:|File:|Deaths_in_|List_of_|\d{4}(_in_.*)?$)/;
  (f.mostread?.articles || [])
    .filter((a: WikiSummary) => a.extract && !skip.test(a.title) && a.thumbnail)
    .slice(0, 5)
    .forEach((a: WikiSummary) => cards.push(wikiCard(a, 'mostread', 'general')));

  if (f.image?.image?.source || f.image?.thumbnail?.source) {
    const img = f.image;
    const desc = String(img.description?.text || '').replace(/\s+/g, ' ').trim();
    const artist = String(img.artist?.text || '').replace(/\s+/g, ' ').trim();
    if (desc) cards.push({
      id: `potd-${hash(img.title)}`, kind: 'potd', topic: 'general',
      title: 'Picture of the day',
      extract: clip(desc, 700),
      image: (img.thumbnail?.source || img.image.source).replace(/\/\d+px-/, '/960px-'),
      url: img.file_page || `https://commons.wikimedia.org/wiki/${encodeURIComponent(img.title)}`,
      source: 'Wikipedia',
      ...(artist ? { credit: artist } : {}),
    });
  }

  // On this day: events with a photo become cards; others become "which year?" quizzes
  const events: any[] = (f.onthisday || []).filter((e: any) => e.year && e.text && e.pages?.length);
  const r = seeded(dayNum(date));
  const shuffled = shuffle(events, r);
  const withPic = shuffled.filter(e => e.pages.some((p: WikiSummary) => p.thumbnail && !/^\d+$/.test(p.title)));
  withPic.slice(0, 5).forEach(e => {
    const p: WikiSummary = e.pages.find((p: WikiSummary) => p.thumbnail && !/^\d+$/.test(p.title));
    cards.push(wikiCard(p, 'onthisday', 'general', { year: e.year, event: e.text }));
  });
  const nowYear = date.getUTCFullYear();
  shuffled.filter(e => !withPic.slice(0, 5).includes(e) && !String(e.text).includes(String(e.year))).slice(0, 4).forEach(e => {
    const offsets = shuffle([-12, -9, -7, -5, -4, -3, -2, 2, 3, 4, 5, 7, 9, 12], r);
    const wrong: number[] = [];
    for (const o of offsets) { const y = e.year + o; if (y <= nowYear && y > 0 && !wrong.includes(y)) wrong.push(y); if (wrong.length === 2) break; }
    const opts = shuffle([e.year, ...wrong], r);
    const page: WikiSummary | undefined = e.pages.find((p: WikiSummary) => !/^\d+$/.test(p.title)) || e.pages[0];
    quizzes.push({
      id: `otd-${hash(e.text)}`, topic: 'general',
      q: 'In which year did this happen?',
      prompt: e.text,
      opts: opts.map(String), answer: opts.indexOf(e.year),
      explain: `It happened in ${e.year}.`,
      source: { name: 'Wikipedia, On this day', url: page ? pageUrl(page) : 'https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries' },
      ...(page?.extract ? { article: { title: titleOf(page), extract: clip(page.extract, 900), image: bestImage(page), url: pageUrl(page), source: 'Wikipedia' } as QuizArticle } : {}),
    });
  });
  return { cards, quizzes };
}

/* Learning cards for every interest (and extra topics like BSL): a few titles a day, rotating through each list */
/* Each interest's pool of Wikipedia articles: its hand-picked titles, plus articles Wikipedia itself says are
   similar ("morelike" search). The pool grows over time and is refreshed a few seeds at a time, weekly. */
export type LearnPool = Record<string, { titles: string[]; refreshed: string; seedAt: number }>;
const JUNK = /^(List|Lists|Outline|Index|Timeline|Glossary|Bibliography) of |\(disambiguation\)|^\d{1,4}( BC| AD)?$|^\d{4} in /i;

async function related(title: string): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=0&srlimit=12&srqiprofile=classic_noboostlinks&srsearch=${encodeURIComponent(`morelike:${title}`)}`;
  try { const r = await fetchJSON<any>(url); return (r?.query?.search || []).map((x: any) => String(x.title)).filter((t: string) => !JUNK.test(t)); } catch { return []; }
}

export async function growPools(interests: Interest[], pool0: LearnPool, date: Date): Promise<LearnPool> {
  const pools: LearnPool = { ...pool0 };
  const week = 7 * 86400_000;
  let found = 0;
  const due = interests.filter(i => i.wiki.length && (!pools[i.id] || +date - +new Date(pools[i.id].refreshed) > week));
  await pool(due, 3, async i => {
    const p = pools[i.id] || { titles: [], refreshed: '', seedAt: 0 };
    // Four seeds per refresh, taking turns through the hand-picked list
    const seeds = [0, 1, 2, 3].map(k => i.wiki[(p.seedAt + k) % i.wiki.length]);
    const more: string[] = [];
    for (const t of seeds) { more.push(...(await related(t))); await sleep(120); }
    const titles = [...new Set([...p.titles, ...more])].filter(t => !i.wiki.includes(t)).slice(0, 120);
    found += titles.length - p.titles.length;
    pools[i.id] = { titles, refreshed: date.toISOString(), seedAt: (p.seedAt + 4) % Math.max(1, i.wiki.length) };
  });
  record('Wikipedia related articles', 'https://en.wikipedia.org/w/api.php?list=search&srsearch=morelike:{title}', true, found, due.length ? `${due.length} interests refreshed` : 'none due');
  return pools;
}

/* Many summaries in one request: Wikipedia's Action API gives up to 20 intros at a time (far kinder than 300 separate calls) */
async function wikiBatch(titles: string[]): Promise<Map<string, WikiSummary>> {
  const out = new Map<string, WikiSummary>();
  const uniq = [...new Set(titles)];
  for (let i = 0; i < uniq.length; i += 20) {
    const chunk = uniq.slice(i, i + 20);
    const q = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts|pageimages|info|description|pageprops|pageviews&pvipdays=30&ppprop=disambiguation&exintro=1&explaintext=1&exlimit=20&piprop=thumbnail|original&pithumbsize=960&pilimit=20&inprop=url&titles=${encodeURIComponent(chunk.join('|'))}`;
    let r: any = null;
    for (let attempt = 0; attempt < 3 && !r; attempt++) { try { r = await fetchJSON<any>(q); } catch { await sleep(1500 * (attempt + 1)); } }
    if (!r?.query) continue;
    // Requested titles may come back normalised or redirected: map them back
    const back = new Map<string, string>();
    for (const n of r.query.normalized || []) back.set(n.to, n.from);
    for (const d of r.query.redirects || []) back.set(d.to, back.get(d.from) || d.from);
    for (const p of r.query.pages || []) {
      if (p.missing || !p.extract || p.pageprops?.disambiguation !== undefined) continue;
      const s: WikiSummary = {
        title: p.title, extract: p.extract, ...(p.description ? { description: p.description } : {}),
        ...(p.thumbnail ? { thumbnail: { source: p.thumbnail.source, width: p.thumbnail.width } } : {}),
        ...(p.original ? { originalimage: { source: p.original.source, width: p.original.width } } : {}),
        content_urls: { desktop: { page: p.fullurl } },
      };
      const views = Object.values(p.pageviews || {}).filter((x): x is number => typeof x === 'number');
      if (views.length) s.pop = Math.round(views.reduce((a, b) => a + b, 0) / views.length);
      out.set(p.title, s);
      const asked = back.get(p.title); if (asked) out.set(asked, s);
    }
    await sleep(250);
  }
  return out;
}

/* Articles this well known (average daily views) are general knowledge: most people know the basics already */
export const TOO_KNOWN = 6000;

export async function topicCards(interests: Interest[], extra: Record<string, string[]>, date: Date, pools: LearnPool = {}, perTopic = 7): Promise<LearnCard[]> {
  const jobs: { topic: TopicKey; interest?: string; title: string }[] = [];
  const day = dayNum(date);
  const lists: { topic: TopicKey; interest?: string; titles: string[]; n: number }[] = [
    // The wider pool first: the hand-picked titles are mostly the broad basics people already know, so they come last
    ...interests.map(i => ({ topic: i.cat, interest: i.id, titles: [...(pools[i.id]?.titles || []), ...i.wiki], n: perTopic })),
    ...Object.entries(extra).filter(([k, v]) => !k.startsWith('_') && Array.isArray(v)).map(([k, v]) => ({ topic: k as TopicKey, titles: v as string[], n: 3 })),
  ];
  // Three times as many titles as needed, so a short, missing or too-well-known article doesn't leave a gap
  const want = new Map<string, number>();
  for (const l of lists) {
    if (!l.titles.length) continue;
    const key = l.interest || l.topic;
    want.set(key, l.n);
    for (let k = 0; k < Math.min(l.n * 3, l.titles.length); k++) jobs.push({ topic: l.topic, interest: l.interest, title: l.titles[(day * l.n + k) % l.titles.length] });
  }
  const found = await wikiBatch(jobs.map(j => j.title));
  let ok = 0; const missing: string[] = [];
  const have = new Map<string, number>();
  const out = jobs.map(j => {
    const key = j.interest || j.topic;
    if ((have.get(key) || 0) >= (want.get(key) || 0)) return null;
    const s = found.get(j.title);
    // Only articles with enough to learn from
    if (!s || s.extract.length < 280) { missing.push(j.title); return null; }
    if (j.interest && (s.pop || 0) > TOO_KNOWN) { missing.push(`${j.title} (too well known)`); return null; }
    ok++; have.set(key, (have.get(key) || 0) + 1);
    return wikiCard(s, 'topic', j.topic, j.interest ? { interest: j.interest } : {});
  });
  record('Wikipedia topic summaries', 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts (20 at a time)', ok > 0, ok, missing.length ? `skipped ${missing.length}: ${missing.slice(0, 12).join('; ')}` : undefined);
  // The same article can sit in two lists: keep one card
  const seen = new Set<string>();
  return (out.filter(Boolean) as LearnCard[]).filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/* ---------- Did you know… (Wikipedia's main page facts) ----------
   Every day Wikipedia's editors pick surprising facts from new or improved articles, each checked against a
   cited source in that article. They're the opposite of general knowledge. The recent ones are collected here
   into a pool (kept in pipeline/cache/facts.json), and a few new ones go out each day. */

export interface Hook { hook: string; title: string; added: string }
export type FactPool = { hooks: Hook[]; archived?: string };

const decode = (x: string) => x.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

export function parseHooks(html: string): { hook: string; title: string }[] {
  const out: { hook: string; title: string }[] = [];
  for (const m of html.matchAll(/<li>\s*(?:\.\.\.|…)\s*that\b([\s\S]*?)<\/li>/g)) {
    const inner = m[1];
    // The article the fact comes from is the bold link
    const b = inner.match(/<b>(?:\s*<i>)?\s*<a [^>]*href="\/wiki\/([^"#?]+)"/);
    if (!b) continue;
    let title: string; try { title = decodeURIComponent(b[1]).replace(/_/g, ' '); } catch { continue; }
    if (/^[A-Za-z]+:/.test(title)) continue;
    const text = decode(inner.replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]+>/g, ''))
      .replace(/\s*\((?:pictured|illustrated|shown|depicted|example pictured|detail pictured)[^)]*\)/gi, '')
      .replace(/\s+/g, ' ').trim();
    if (!text.endsWith('?') || text.length < 30 || text.length > 240) continue;
    out.push({ hook: `…that ${text}`, title });
  }
  return out;
}

async function parsed(page: string): Promise<string> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&disablelimitreport=1&page=${encodeURIComponent(page)}`;
  const r = await fetchJSON<any>(url, { timeout: 30000 });
  return String(r?.parse?.text || '');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* Which part of the app a fact belongs to, from the article's own short description */
const FACT_TOPICS: [RegExp, TopicKey][] = [
  [/\b(footballer|cricketer|athlete|cyclist|rugby|tennis|boxer|olympi|racing driver|golfer|football club|basketball|baseball|sportsperson|jockey|swimmer|wrestler)/i, 'sport'],
  [/\b(species|genus|family of|moth|beetle|snail|bird|fish|frog|spider|plant|fungus|bacteri|asteroid|galaxy|star\b|planet|crater|chemical|mineral|disease|physicist|chemist|biologist|astronomer|mathematician|volcano|dinosaur)/i, 'science'],
  [/\b(software|computer|video game|internet|website|engineer|aircraft|locomotive|ship\b|car\b|rocket|spacecraft)/i, 'tech'],
  [/\b(company|business|bank|economist|businessman|businesswoman|brand|entrepreneur)/i, 'money'],
  [/\b(album|song|single|film|novel|book|painting|painter|artist|singer|actor|actress|band|poem|poet|opera|television|writer|composer|musician|sculpt|play\b|dancer|photographer|architect|building|church|castle|cathedral|museum|battle|war\b|king|queen|emperor|dynasty|politician|archaeolog|historian|saint|bishop|monarch)/i, 'culture'],
];
const factTopic = (d = '') => FACT_TOPICS.find(([re]) => re.test(d))?.[1] || 'general';

export async function didYouKnow(pool0: FactPool, date: Date): Promise<{ pool: FactPool; cards: LearnCard[] }> {
  const day = date.toISOString().slice(0, 10);
  const have = new Set(pool0.hooks.map(h => h.hook));
  const fresh: Hook[] = [];
  const add = (xs: { hook: string; title: string }[]) => xs.forEach(x => { if (!have.has(x.hook)) { have.add(x.hook); fresh.push({ ...x, added: day }); } });
  const pages = ['Template:Did you know', 'Wikipedia:Recent additions'];
  // Once, to start the pool: last month's archive
  const lastMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  const archive = `Wikipedia:Recent additions/${lastMonth.getUTCFullYear()}/${MONTHS[lastMonth.getUTCMonth()]}`;
  if (pool0.archived !== archive) pages.push(archive);
  let ok = 0; const errs: string[] = [];
  for (const pg of pages) {
    try { const hs = parseHooks(await parsed(pg)); ok += hs.length; add(hs); } catch (e: any) { errs.push(`${pg}: ${e?.message}`); }
    await sleep(300);
  }
  record('Wikipedia: Did you know', 'https://en.wikipedia.org/wiki/Wikipedia:Recent_additions', ok > 0, ok, errs.length ? errs.join('; ') : `${fresh.length} new`);
  const hooks = [...fresh, ...pool0.hooks].slice(0, 2000);
  const pool: FactPool = { hooks, archived: pages.includes(archive) && ok ? archive : pool0.archived };
  // Today: the newest facts first, then a slow rotation through the rest, so nothing repeats for months
  const newest = hooks.filter(h => h.added >= new Date(+date - 2 * 86400_000).toISOString().slice(0, 10)).slice(0, 12);
  const rest = hooks.filter(h => !newest.includes(h));
  const d = dayNum(date);
  const rot = rest.length ? Array.from({ length: Math.min(24, rest.length) }, (_, k) => rest[(d * 8 + k) % rest.length]) : [];
  const pick = [...new Set([...newest, ...rot])];
  const found = await wikiBatch(pick.map(h => h.title));
  const cards: LearnCard[] = [];
  for (const h of pick) {
    const s = found.get(h.title);
    if (!s) continue;
    cards.push({ ...wikiCard(s, 'fact', factTopic(s.description)), id: `dyk-${hash(h.hook)}`, hook: h.hook });
  }
  return { pool, cards };
}

/* ---------- NASA Astronomy Picture of the Day ---------- */

export async function apod(): Promise<LearnCard | null> {
  const key = process.env.NASA_API_KEY || 'DEMO_KEY';
  const url = `https://api.nasa.gov/planetary/apod?thumbs=true&api_key=${key}`;
  try {
    const a = await fetchJSON<any>(url);
    const image = a.media_type === 'image' ? a.url : a.thumbnail_url;
    const [y, m, d] = String(a.date).split('-');
    record('NASA APOD', url.replace(key, '***'), true, 1);
    return {
      id: `apod-${a.date}`, kind: 'apod', topic: 'space',
      title: a.title, extract: String(a.explanation || '').trim(),
      ...(image ? { image } : {}),
      url: `https://apod.nasa.gov/apod/ap${y.slice(2)}${m}${d}.html`,
      source: 'NASA',
      ...(a.copyright ? { credit: String(a.copyright).replace(/\s+/g, ' ').trim() } : {}),
    };
  } catch (e: any) {
    record('NASA APOD', url.replace(key, '***'), false, 0, e?.message);
    return null;
  }
}

/* ---------- Wikidata quizzes: question and answer both come from the data ---------- */

async function sparql(query: string): Promise<any[]> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const r = await fetchJSON<any>(url, { headers: { Accept: 'application/sparql-results+json' }, timeout: 60000 });
  return r.results.bindings;
}
const v = (b: any, k: string) => b[k]?.value as string | undefined;
const qid = (u?: string) => u?.split('/').pop() || '';
const wikiTitleFromUrl = (u?: string) => (u ? decodeURIComponent(u.split('/wiki/')[1] || '').replace(/_/g, ' ') : '');
const LABEL = 'SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }';

export async function wikidataQuizzes(date: Date): Promise<Quiz[]> {
  const r = seeded(dayNum(date) * 7 + 3);
  const quizzes: Quiz[] = [];
  const mk = async (id: string, q: string, answer: string, wrongPool: string[], explain: string, entity: string, articleUrl?: string) => {
    const wrong = shuffle([...new Set(wrongPool.filter(w => w && w !== answer))], r).slice(0, 2);
    if (wrong.length < 2) return;
    const opts = shuffle([answer, ...wrong], r);
    let article: QuizArticle | undefined;
    const t = wikiTitleFromUrl(articleUrl);
    if (t) { const s = await wikiSummary(t); if (s) article = { title: titleOf(s), extract: clip(s.extract, 900), image: bestImage(s), url: pageUrl(s), source: 'Wikipedia' }; }
    quizzes.push({ id, topic: 'general', q, opts, answer: opts.indexOf(answer), explain, source: { name: 'Wikidata', url: `https://www.wikidata.org/wiki/${entity}` }, ...(article ? { article } : {}) });
  };
  const isLabel = (s?: string) => !!s && !/^Q\d+$/.test(s);

  try {
    const rows = await sparql(`SELECT ?country ?countryLabel ?capital ?capitalLabel ?article WHERE {
      ?country wdt:P31 wd:Q3624078; wdt:P36 ?capital. FILTER NOT EXISTS { ?country wdt:P576 ?end }
      OPTIONAL { ?article schema:about ?capital; schema:isPartOf <https://en.wikipedia.org/>. } ${LABEL} }`);
    const by = new Map<string, any[]>();
    rows.forEach(b => { const k = v(b, 'country')!; by.set(k, [...(by.get(k) || []), b]); });
    const single = [...by.values()].filter(g => new Set(g.map(b => v(b, 'capital'))).size === 1).map(g => g[0]).filter(b => isLabel(v(b, 'countryLabel')) && isLabel(v(b, 'capitalLabel')));
    record('Wikidata: capitals', 'https://query.wikidata.org/sparql', single.length > 10, single.length);
    const pick = shuffle(single, r)[0];
    if (pick) await mk(`wd-cap-${qid(v(pick, 'country'))}`, `What is the capital of ${v(pick, 'countryLabel')}?`, v(pick, 'capitalLabel')!, single.map(b => v(b, 'capitalLabel')!), `The capital of ${v(pick, 'countryLabel')} is ${v(pick, 'capitalLabel')}.`, qid(v(pick, 'country')), v(pick, 'article'));
  } catch (e: any) { record('Wikidata: capitals', 'https://query.wikidata.org/sparql', false, 0, e?.message); }

  try {
    const rows = await sparql(`SELECT ?el ?elLabel ?symbol ?num ?article WHERE {
      ?el wdt:P31 wd:Q11344; wdt:P246 ?symbol; wdt:P1086 ?num. FILTER(?num <= 100)
      OPTIONAL { ?article schema:about ?el; schema:isPartOf <https://en.wikipedia.org/>. } ${LABEL} }`);
    const els = rows.filter(b => isLabel(v(b, 'elLabel')) && v(b, 'symbol'));
    record('Wikidata: elements', 'https://query.wikidata.org/sparql', els.length > 10, els.length);
    // Prefer elements whose symbol doesn't simply start the name, which makes a better question
    const pick = shuffle(els, r)[0];
    if (pick) {
      const sym = v(pick, 'symbol')!, name = v(pick, 'elLabel')!;
      const similarSyms = els.map(b => v(b, 'symbol')!).filter(s => s[0] === sym[0]);
      const pool = similarSyms.length >= 3 ? similarSyms : els.map(b => v(b, 'symbol')!);
      await mk(`wd-el-${qid(v(pick, 'el'))}`, `What is the chemical symbol for ${name}?`, sym, pool, `${name[0].toUpperCase() + name.slice(1)} has the symbol ${sym} and atomic number ${v(pick, 'num')}.`, qid(v(pick, 'el')), v(pick, 'article'));
    }
  } catch (e: any) { record('Wikidata: elements', 'https://query.wikidata.org/sparql', false, 0, e?.message); }

  try {
    const rows = await sparql(`SELECT ?country ?countryLabel ?cur ?curLabel ?article WHERE {
      ?country wdt:P31 wd:Q3624078; wdt:P38 ?cur. FILTER NOT EXISTS { ?country wdt:P576 ?end }
      OPTIONAL { ?article schema:about ?cur; schema:isPartOf <https://en.wikipedia.org/>. } ${LABEL} }`);
    const by = new Map<string, any[]>();
    rows.forEach(b => { const k = v(b, 'country')!; by.set(k, [...(by.get(k) || []), b]); });
    const single = [...by.values()].filter(g => new Set(g.map(b => v(b, 'cur'))).size === 1).map(g => g[0]).filter(b => isLabel(v(b, 'countryLabel')) && isLabel(v(b, 'curLabel')));
    record('Wikidata: currencies', 'https://query.wikidata.org/sparql', single.length > 10, single.length);
    const pick = shuffle(single, r)[0];
    if (pick) await mk(`wd-cur-${qid(v(pick, 'country'))}`, `What is the currency of ${v(pick, 'countryLabel')}?`, v(pick, 'curLabel')!, single.map(b => v(b, 'curLabel')!), `${v(pick, 'countryLabel')} uses the ${v(pick, 'curLabel')}.`, qid(v(pick, 'country')), v(pick, 'article'));
  } catch (e: any) { record('Wikidata: currencies', 'https://query.wikidata.org/sparql', false, 0, e?.message); }

  return quizzes;
}

/* ---------- HubSpot ---------- */

const CHANGELOG_FEEDS = [
  'https://developers.hubspot.com/changelog/rss.xml',
  'https://developers.hubspot.com/changelog/rss',
];

export async function hubspot(): Promise<HubItem[]> {
  const out: HubItem[] = [];
  for (const url of CHANGELOG_FEEDS) {
    const items = await getFeed('HubSpot developer changelog', url, 'HubSpot Developers');
    if (items.length) {
      items.slice(0, 12).forEach(i => out.push({ id: `hs-${hash(i.url)}`, kind: 'changelog', title: i.title, summary: i.summary, url: i.url, published: i.published, ...(i.image ? { image: i.image } : {}) }));
      break;
    }
  }
  const blog = await getFeed('HubSpot blog', 'https://blog.hubspot.com/marketing/rss.xml', 'HubSpot blog');
  blog.slice(0, 10).forEach(i => out.push({ id: `hs-${hash(i.url)}`, kind: 'blog', title: i.title, summary: i.summary, url: i.url, published: i.published, ...(i.image ? { image: i.image } : {}) }));
  return out;
}
