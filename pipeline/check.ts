/* npm run check: tests every key and source once and prints a pass or fail list.
   It also runs the serverless functions in /api directly, so they can be tested before deploying. */
import { fetchText, fetchJSON } from './http';
import { NEWS_FEEDS, BBC_REGIONS, SPORT_FEEDS } from './sources';
import { modelList } from './summarise';
import { GET as interestSearch } from '../api/interest-search';
import { GET as skill } from '../api/skill';
import { GET as local } from '../api/local';
import { GET as live } from '../api/live';
import { GET as news, OUTLETS, outletItems } from '../api/news';
import { readdir, readFile } from 'node:fs/promises';

type Row = [string, boolean | null, string];
const rows: Row[] = [];
const ok = (name: string, detail = '') => rows.push([name, true, detail]);
const bad = (name: string, detail: string) => rows.push([name, false, detail]);
const skip = (name: string, detail: string) => rows.push([name, null, detail]);

async function test(name: string, fn: () => Promise<string>) {
  try { ok(name, await fn()); } catch (e: any) { bad(name, e?.message || String(e)); }
}
const call = async (fn: (r: Request) => Promise<Response>, url: string) => {
  const res = await fn(new Request(`https://knowfeed.local${url}`));
  const body = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
  return body;
};

async function main() {
  const keys: [string, string, boolean][] = [
    ['GEMINI_API_KEY', 'AI summaries', true], ['GUARDIAN_API_KEY', 'Guardian news and interest search', true],
    ['NASA_API_KEY', 'NASA picture of the day (works without, with low limits)', false], ['API_FOOTBALL_KEY', 'live football', false],
    ['UNSPLASH_ACCESS_KEY', 'backup photos (optional)', false], ['PEXELS_API_KEY', 'backup photos (optional)', false],
  ];
  for (const [k, what, needed] of keys) (process.env[k] ? ok : needed ? bad : skip)(`${k}`, process.env[k] ? what : `not set: ${what}`);

  await test('BBC News feeds', async () => {
    let n = 0; for (const f of NEWS_FEEDS.filter(f => f.outlet === 'BBC News')) { const x = await fetchText(f.url); n += (x.match(/<item>/g) || []).length; }
    if (!n) throw new Error('no items'); return `${n} items`;
  });
  await test('Other news feeds', async () => {
    const out: string[] = [];
    for (const f of NEWS_FEEDS.filter(f => f.outlet !== 'BBC News')) { try { const x = await fetchText(f.url); out.push(`${f.outlet} ${(x.match(/<(item|entry)[\s>]/g) || []).length}`); } catch (e: any) { out.push(`${f.outlet} FAILED ${e.message}`); } }
    if (out.some(o => o.includes('FAILED'))) throw new Error(out.join(', ')); return out.join(', ');
  });
  await test('BBC local feeds', async () => {
    const failed: string[] = []; for (const r of BBC_REGIONS) { try { await fetchText(r.url); } catch { failed.push(r.name); } }
    if (failed.length) throw new Error(`failed: ${failed.join(', ')}`); return `${BBC_REGIONS.length} regions`;
  });
  await test('BBC Sport feeds', async () => { for (const u of Object.values(SPORT_FEEDS)) await fetchText(u); return `${Object.keys(SPORT_FEEDS).length} sports`; });
  if (process.env.GUARDIAN_API_KEY) await test('Guardian API', async () => { const r = await fetchJSON<any>(`https://content.guardianapis.com/search?section=world&page-size=1&api-key=${process.env.GUARDIAN_API_KEY}`); return `${r.response?.total} world articles`; });
  if (process.env.GEMINI_API_KEY) await test('Gemini API', async () => { const m = await modelList(process.env.GEMINI_API_KEY!); return `models: ${m.join(', ')}`; });
  await test('Wikipedia', async () => { const r = await fetchJSON<any>('https://en.wikipedia.org/api/rest_v1/page/summary/Octopus'); return r.title; });
  await test('Wikidata', async () => { const r = await fetchJSON<any>(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent('SELECT ?x WHERE { wd:Q84 wdt:P1376 ?x } LIMIT 1')}`); return `${r.results.bindings.length} row`; });
  await test('NASA APOD', async () => { const r = await fetchJSON<any>(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY || 'DEMO_KEY'}`); return r.title; });
  await test('Jolpica F1', async () => { const r = await fetchJSON<any>('https://api.jolpi.ca/ergast/f1/current.json'); return `${r.MRData?.RaceTable?.Races?.length} races`; });
  await test('ESCO API', async () => { const r = await fetchJSON<any>(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent('data analyst')}&type=occupation&language=en&limit=3`); return (r._embedded?.results || []).map((x: any) => x.title).join(', '); });

  // Every outlet people can follow: reachable, with items, and recent
  const outletRows: string[] = []; const outletFails: string[] = [];
  await Promise.all(OUTLETS.map(async o => {
    try {
      const items = await outletItems(o);
      const newest = items[0] ? Math.round((Date.now() - +new Date(items[0].published)) / 3600_000) : -1;
      const withImg = items.filter(i => i.image).length;
      if (!items.length) outletFails.push(`${o.name}: no items`);
      else if (newest > 96) outletFails.push(`${o.name}: newest ${newest}h old`);
      else outletRows.push(`${o.name} ${items.length} (${withImg} img, ${newest}h)`);
    } catch (e: any) { outletFails.push(`${o.name}: ${e?.message || e}`); }
  }));
  rows.push([`Outlet feeds (${OUTLETS.length})`, outletFails.length ? false : true, outletFails.length ? `FAILED: ${outletFails.join(' | ')}  OK: ${outletRows.join(', ')}` : outletRows.join(', ')]);
  for (const region of ['uk', 'us', 'world']) await test(`/api/news breaking ${region}`, async () => { const b = await call(news, `/api/news?mode=breaking&region=${region}`); if (!b.items.length) throw new Error('no items'); return b.items.slice(0, 4).map((i: any) => `${i.title.slice(0, 50)} [${i.outlets.length}]`).join(' | '); });
  await test('/api/news search', async () => { const b = await call(news, '/api/news?mode=search&q=iPhone&region=uk'); if (!b.items.length) throw new Error('no items'); return `${b.items.length} items: ` + b.items.slice(0, 4).map((i: any) => `${i.outlet}: ${i.title.slice(0, 40)}`).join(' | '); });
  await test('/api/news outlet', async () => { const b = await call(news, '/api/news?mode=outlet&id=theverge'); return `${b.items.length} items, first: ${b.items[0]?.title}`; });
  await test('/api/interest-search', async () => { const b = await call(interestSearch, '/api/interest-search?q=rewilding'); if (!b.results.length) throw new Error('no results'); return b.results.slice(0, 3).map((r: any) => `${r.label}${r.guardian ? ' [G]' : ''}${r.wiki ? ' [W]' : ''}`).join(', '); });
  await test('/api/skill', async () => {
    const found = await fetchJSON<any>(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent('data analysis')}&type=skill&language=en&limit=1`);
    const id = String(found._embedded?.results?.[0]?.uri || '').split('/').pop();
    const b = await call(skill, `/api/skill?id=${id}`); return `${b.label}: ${String(b.description).slice(0, 60)}… wiki: ${b.wiki?.title || 'none'}`; });
  if (process.env.GUARDIAN_API_KEY) await test('/api/local', async () => { const b = await call(local, '/api/local?city=Lisbon'); return `${b.stories.length} stories`; });
  if (process.env.API_FOOTBALL_KEY) await test('/api/live', async () => { const b = await call(live, '/api/live?team=Arsenal'); return `${b.team?.name}: next ${b.next?.home?.name} v ${b.next?.away?.name}`; });

  // Series: every cited source must exist, and every quote from a book must appear word for word in the book
  await test('Series sources and quotes', async () => {
    const files = (await readdir('content/series')).filter(f => f.endsWith('.json'));
    const bad: string[] = []; let urls = 0, quotes = 0;
    const norm = (t: string) => t.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').toLowerCase();
    for (const f of files) {
      const s = JSON.parse(await readFile(`content/series/${f}`, 'utf8'));
      for (const src of s.sources) {
        if (src.url.includes('knowfeed')) continue;
        urls++;
        try { await fetchText(src.url); } catch (e: any) { bad.push(`${s.id}: ${src.title} (${e?.message})`); }
      }
      if (s.book?.text) {
        const book = norm(await fetchText(s.book.text));
        for (const e of s.episodes) for (const c of e.cards) if (c.type === 'quote') { quotes++; if (!book.includes(norm(c.text))) bad.push(`${s.id}: quote not found: "${c.text.slice(0, 60)}"`); }
      }
    }
    if (bad.length) throw new Error(bad.join(' | '));
    return `${files.length} series, ${urls} sources, ${quotes} quotes checked`;
  });

  const w = Math.max(...rows.map(r => r[0].length));
  console.log('\nKnowfeed health check\n');
  for (const [n, s, d] of rows) console.log(`${s === true ? 'OK  ' : s === false ? 'FAIL' : 'SKIP'}  ${n.padEnd(w)}  ${d}`);
  const failed = rows.filter(r => r[1] === false).length;
  console.log(`\n${rows.filter(r => r[1] === true).length} OK, ${failed} failed, ${rows.filter(r => r[1] === null).length} skipped`);
  if (failed) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exit(1); });
