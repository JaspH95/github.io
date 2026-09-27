/* One-off data for onboarding, refreshed monthly (or by hand from the Actions tab):
   - ESCO occupations and their skills, for "What do you do for work?"
   - GeoNames cities, for the city autocomplete
   npm run seed                  both
   npm run seed -- --only=esco   one part: esco | cities */
import { mkdir, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { fetchJSON, sleep, record, status } from './util';
import { httpBytes } from './http';
import type { OccupationsFile, Occupation } from '../src/types';

const OUT = 'public/data';
const ESCO = 'https://ec.europa.eu/esco/api';
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
const want = (p: string) => !only || only.split(',').includes(p);

/* ---------- ESCO ---------- */

const en = (x: any): string => (x?.en?.literal ?? x?.en ?? x?.['en-us'] ?? '') as string;
const enList = (x: any): string[] => (Array.isArray(x?.en) ? x.en : []) as string[];
const short = (uri: string) => uri.split('/').pop()!;

async function esco<T = any>(path: string, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fetchJSON<T>(`${ESCO}${path}`, { timeout: 60000 }); }
    catch (e) { if (i >= tries) throw e; await sleep(2000 * (i + 1)); }
  }
}

interface Full { uri: string; title: string; alt: string[]; group: string; desc: string; essential: { uri: string; title: string }[]; optional: { uri: string; title: string }[] }

function toFull(o: any): Full | null {
  const title = en(o.preferredLabel) || o.title;
  if (!title) return null;
  const links = o._links || {};
  const grp = (links.broaderIscoGroup || []).map((g: any) => g.code || short(g.uri))[0] || '';
  const skills = (k: string) => (links[k] || []).map((s: any) => ({ uri: s.uri, title: s.title })).filter((s: any) => s.uri && s.title);
  return {
    uri: o.uri, title, alt: enList(o.alternativeLabel).slice(0, 12), group: String(grp).replace(/^C/, ''),
    desc: en(o.description), essential: skills('hasEssentialSkill'), optional: skills('hasOptionalSkill'),
  };
}

/* Walk ISCO groups down to their occupations (and occupations down to narrower ones) */
const shape = (o: any) => o && typeof o === 'object' ? `keys=${Object.keys(o).join(',')} links=${Object.keys(o._links || {}).join(',')} embedded=${Object.keys(o._embedded || {}).join(',')}` : String(o);

/* Occupation URIs from the search API, a page at a time */
async function searchAll(): Promise<string[]> {
  const uris: string[] = [];
  for (let offset = 0; offset < 6000; offset += 100) {
    const r = await esco<any>(`/search?language=en&type=occupation&limit=100&offset=${offset}&full=false`).catch((e: any) => { console.log(`  search failed at ${offset}: ${e.message}`); return null; });
    if (offset === 0) console.log(`ESCO search shape: ${shape(r)} total=${r?.total} first=${JSON.stringify(r?._embedded?.results?.[0] || {}).slice(0, 400)}`);
    const got = (r?._embedded?.results || []).map((x: any) => x.uri).filter(Boolean);
    uris.push(...got);
    if (got.length < 100) break;
    await sleep(150);
  }
  return [...new Set(uris)];
}

async function walk(): Promise<Full[]> {
  let queue: string[] = [];
  for (const scheme of ['http://data.europa.eu/esco/concept-scheme/isco', 'http://data.europa.eu/esco/concept-scheme/occupations']) {
    for (const res of ['concept', 'taxonomy']) {
      const r = await esco<any>(`/resource/${res}?uri=${encodeURIComponent(scheme)}&language=en`).catch((e: any) => ({ error: e.message }));
      console.log(`ESCO ${res} ${scheme.split('/').pop()}: ${shape(r)} ${r?.error || ''}`);
      const top = (r?._links?.hasTopConcept || r?._embedded?.hasTopConcept || []).map((c: any) => c.uri).filter(Boolean);
      if (top.length && !queue.length) queue = top;
    }
  }
  console.log(`ESCO: ${queue.length} top groups`);
  const occUris = new Set<string>();
  const seenGroups = new Set<string>();
  while (queue.length) {
    const batch = queue.splice(0, 6);
    const res = await Promise.all(batch.map(u => seenGroups.has(u) ? null : (seenGroups.add(u), esco<any>(`/resource/concept?uri=${encodeURIComponent(u)}&language=en`).catch(() => null))));
    for (const g of res) {
      if (!g) continue;
      (g._links?.narrowerConcept || []).forEach((c: any) => queue.push(c.uri));
      (g._links?.narrowerOccupation || []).forEach((o: any) => occUris.add(o.uri));
    }
    await sleep(150);
  }
  console.log(`ESCO: ${seenGroups.size} groups, ${occUris.size} occupations directly under groups`);
  if (occUris.size < 500) {
    const found = await searchAll();
    console.log(`ESCO search: ${found.length} occupations`);
    found.forEach(u => occUris.add(u));
  }
  const out = new Map<string, Full>();
  const todo = [...occUris];
  const parentGroup = new Map<string, string>();
  while (todo.length) {
    const batch = todo.splice(0, 8);
    const res = await Promise.all(batch.map(u => esco<any>(`/resource/occupation?uri=${encodeURIComponent(u)}&language=en`).catch(() => null)));
    if (!out.size && res[0]) console.log(`ESCO occupation shape: ${shape(res[0])} broaderIscoGroup=${JSON.stringify(res[0]._links?.broaderIscoGroup || '').slice(0, 200)} essential=${JSON.stringify(res[0]._links?.hasEssentialSkill?.[0] || '').slice(0, 200)}`);
    for (const o of res) {
      if (!o) continue;
      const f = toFull(o);
      if (!f) continue;
      if (!f.group) f.group = parentGroup.get(f.uri) || '';
      if (!out.has(f.uri)) out.set(f.uri, f);
      (o._links?.narrowerOccupation || []).forEach((n: any) => {
        if (!parentGroup.has(n.uri)) parentGroup.set(n.uri, f.group);
        if (!out.has(n.uri) && !todo.includes(n.uri)) todo.push(n.uri);
      });
    }
    if (out.size % 400 < 8) console.log(`  ${out.size} occupations so far`);
    await sleep(120);
  }
  return [...out.values()];
}

async function escoSeed() {
  const version = await esco<any>('/resource/concept?uri=' + encodeURIComponent('http://data.europa.eu/esco/concept-scheme/occupations') + '&language=en')
    .then(r => String(r?.hasVersion?.[0] || r?.version || r?._links?.self?.version || '')).catch(() => '');
  let all: Full[] = [];
  try { all = await walk(); }
  catch (e: any) { record('ESCO occupations', ESCO, false, 0, e?.message); return; }
  record('ESCO occupations', ESCO, all.length > 1000, all.length, all.length > 1000 ? undefined : 'fewer than expected');
  if (all.length < 1000) return;

  // ISCO major and sub-major groups, for the "pick a job family" fallback
  const groups: Record<string, string> = {};
  const codes = [...new Set(all.map(o => o.group.slice(0, 2)).filter(Boolean))];
  for (const c of codes) {
    try { const g = await esco<any>(`/resource/concept?uri=${encodeURIComponent('http://data.europa.eu/esco/isco/C' + c)}&language=en`); groups[c] = en(g.preferredLabel) || g.title; }
    catch { /* skip */ }
    await sleep(80);
  }
  for (const c of [...new Set(codes.map(c => c[0]))]) {
    try { const g = await esco<any>(`/resource/concept?uri=${encodeURIComponent('http://data.europa.eu/esco/isco/C' + c)}&language=en`); groups[c] = en(g.preferredLabel) || g.title; }
    catch { /* skip */ }
  }

  const occupations: Occupation[] = all.map(o => ({ u: short(o.uri), t: o.title, ...(o.alt.length ? { a: o.alt } : {}), g: o.group })).sort((a, b) => a.t.localeCompare(b.t));
  await mkdir(`${OUT}/esco`, { recursive: true });
  await writeFile(`${OUT}/esco/occupations.json`, JSON.stringify({ generated: new Date().toISOString(), version, groups, occupations } satisfies OccupationsFile) + '\n');
  // Skills, split by ISCO major group so the app only loads the part it needs
  const byMajor: Record<string, Record<string, { d: string; e: [string, string][]; o: [string, string][] }>> = {};
  for (const o of all) {
    const m = o.group[0] || 'x';
    (byMajor[m] ||= {})[short(o.uri)] = {
      d: o.desc.slice(0, 600),
      e: o.essential.slice(0, 30).map(s => [short(s.uri), s.title]),
      o: o.optional.slice(0, 20).map(s => [short(s.uri), s.title]),
    };
  }
  for (const [m, data] of Object.entries(byMajor)) await writeFile(`${OUT}/esco/skills-${m}.json`, JSON.stringify(data) + '\n');
  console.log(`ESCO: wrote ${occupations.length} occupations, ${Object.keys(groups).length} groups, ${Object.keys(byMajor).length} skill files`);
}

/* ---------- GeoNames cities ---------- */

/* Minimal zip reader for a single-file archive */
function unzipFirst(buf: Buffer): Buffer {
  const sig = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (sig < 0) throw new Error('not a zip');
  const method = buf.readUInt16LE(sig + 8);
  let size = buf.readUInt32LE(sig + 18);
  const nameLen = buf.readUInt16LE(sig + 26), extraLen = buf.readUInt16LE(sig + 28);
  const start = sig + 30 + nameLen + extraLen;
  if (!size) {
    // Size in the central directory when the local header leaves it out
    const cd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    size = buf.readUInt32LE(cd + 20);
  }
  const data = buf.subarray(start, start + size);
  return method === 0 ? data : inflateRawSync(data);
}

async function citiesSeed() {
  const url = 'https://download.geonames.org/export/dump/cities15000.zip';
  let text = '';
  try { text = unzipFirst(await httpBytes(url, 120000)).toString('utf8'); }
  catch (e: any) { record('GeoNames cities', url, false, 0, e?.message); return; }
  const rows = text.split('\n').map(l => l.split('\t')).filter(r => r.length > 14);
  // Everywhere with 50,000+ people, plus every UK and Irish town with 15,000+
  const keep = rows.filter(r => +r[14] >= 50000 || ((r[8] === 'GB' || r[8] === 'IE') && +r[14] >= 15000));
  const cities = keep
    .map(r => [r[1], r[8], Math.round(+r[4] * 100) / 100, Math.round(+r[5] * 100) / 100, +r[14]] as [string, string, number, number, number])
    .sort((a, b) => b[4] - a[4])
    .map(([n, c, lat, lon]) => [n, c, lat, lon]);
  record('GeoNames cities', url, cities.length > 1000, cities.length);
  await writeFile(`${OUT}/cities.json`, JSON.stringify({ generated: new Date().toISOString(), note: 'GeoNames (CC BY 4.0): name, country code, latitude, longitude; biggest first', cities }) + '\n');
}

async function main() {
  await mkdir(OUT, { recursive: true });
  if (want('cities')) await citiesSeed();
  if (want('esco')) await escoSeed();
  const failed = status.filter(s => !s.ok);
  console.log(`\nseed: ${status.length - failed.length}/${status.length} OK`);
  if (failed.length) { console.log(failed.map(f => `  ${f.name}: ${f.error}`).join('\n')); process.exitCode = 1; }
}
main().catch(e => { console.error(e); process.exit(1); });
