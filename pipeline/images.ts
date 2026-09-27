/* Every story gets the best image available, in this order:
   1. the article's own image (feed media, the Guardian's biggest asset, or the page's og:image)
   2. a Wikipedia/Wikimedia Commons image of the story's main person, place or thing
   3. a stock photo from Unsplash or Pexels, when their keys are set
   4. nothing: the app draws the topic's designed cover
   Each image is checked (size, shape, not a logo) and gets a tiny blurred preview and a focal point. */
import sharp from 'sharp';
import smartcrop from 'smartcrop';
import { httpBytes } from './http';
import { fetchJSON, pool } from './util';
import { readPage } from './fulltext';
import type { Img } from '../src/types';
import type { Stored } from './stories';

export type ImageCache = Record<string, { w?: number; h?: number; lqip?: string; focus?: [number, number]; bad?: string; at: string }>;
export const imageStats: Record<string, number> = {};
const bump = (k: string) => { imageStats[k] = (imageStats[k] || 0) + 1; };

/* smartcrop needs raw pixels; sharp provides them */
const iop = {
  open: async (buf: Buffer) => { const img = sharp(buf); const m = await img.metadata(); return { width: m.width!, height: m.height!, _buf: buf }; },
  resample: async (image: any, width: number, height: number) => ({ width: ~~width, height: ~~height, _buf: image._buf }),
  getData: async (image: any) => {
    const data = await sharp(image._buf).resize(image.width, image.height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
    return new (smartcrop as any).ImgData(image.width, image.height, data);
  },
};

async function analyse(url: string): Promise<ImageCache[string]> {
  try { return await analyseBuffer(await httpBytes(url, 20000)); }
  catch (e: any) { return { bad: `download failed: ${e?.message || e}`, at: new Date().toISOString() }; }
}

export async function analyseBuffer(buf: Buffer): Promise<ImageCache[string]> {
  const at = new Date().toISOString();
  try {
    if (buf.length > 12 * 1024 * 1024) return { bad: 'file too big', at };
    const img = sharp(buf, { failOn: 'none' });
    const m = await img.metadata();
    const w = m.width || 0, h = m.height || 0;
    if (!w || !h) return { bad: 'unreadable', at };
    if (w < 480) return { w, h, bad: `too small (${w}px)`, at };
    const ratio = w / h;
    if (ratio > 2.6 || ratio < 0.45) return { w, h, bad: `odd shape (${ratio.toFixed(2)})`, at };
    // Logos and text graphics have very few colours
    const stats = await sharp(buf).resize(96, 96, { fit: 'inside' }).stats();
    if (stats.entropy < 3.2) return { w, h, bad: `looks like a logo or graphic (entropy ${stats.entropy.toFixed(1)})`, at };
    const small = await sharp(buf).resize(480, 480, { fit: 'inside' }).toBuffer();
    const lqip = 'data:image/webp;base64,' + (await sharp(small).resize(24, 24, { fit: 'inside' }).webp({ quality: 45 }).toBuffer()).toString('base64');
    // Focal point: where a tall (9:16) crop and a wide (16:9) crop would centre
    const sm = await sharp(small).metadata();
    const tall = (await (smartcrop as any).crop(small, { width: 9, height: 16, imageOperations: iop })).topCrop;
    const wide = (await (smartcrop as any).crop(small, { width: 16, height: 9, imageOperations: iop })).topCrop;
    const fx = Math.round(((tall.x + tall.width / 2) / sm.width!) * 100);
    const fy = Math.round(((wide.y + wide.height / 2) / sm.height!) * 100);
    return { w, h, lqip, focus: [fx, fy], at };
  } catch (e: any) {
    return { bad: `unreadable: ${e?.message || e}`, at };
  }
}

/* BBC and Wikimedia serve bigger sizes from the same address */
function variants(u: string): string[] {
  if (/ichef\.bbci\.co\.uk\/(ace\/standard|news)\/\d+\//.test(u)) return [1536, 1024, 976].map(n => u.replace(/(ichef\.bbci\.co\.uk\/(?:ace\/standard|news))\/\d+\//, `$1/${n}/`));
  if (/upload\.wikimedia\.org\/.*\/\d+px-/.test(u)) return [u.replace(/\/\d+px-/, '/1280px-'), u];
  return [u];
}

type Checked = { url: string; w?: number; h?: number; lqip?: string; focus?: [number, number] };
async function check(url: string, cache: ImageCache, spend: () => void): Promise<Checked | null> {
  for (const v of variants(url)) {
    let c = cache[v];
    if (!c) { c = await analyse(v); cache[v] = c; bump('analysed'); spend(); }
    if (!c.bad) return { url: v, w: c.w, h: c.h, lqip: c.lqip, focus: c.focus };
  }
  return null;
}

async function unsplash(q: string): Promise<Img | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY; if (!key) return null;
  try {
    const r = await fetchJSON<any>(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=5&orientation=portrait&content_filter=high&client_id=${key}`);
    const p = r.results?.[0]; if (!p) return null;
    // Unsplash asks for a download to be recorded when a photo is used
    fetchJSON(`${p.links.download_location}&client_id=${key}`).catch(() => {});
    return { url: p.urls.regular, source: 'unsplash', credit: `${p.user.name} on Unsplash`, link: `${p.links.html}?utm_source=knowfeed&utm_medium=referral` };
  } catch { return null; }
}

async function pexels(q: string): Promise<Img | null> {
  const key = process.env.PEXELS_API_KEY; if (!key) return null;
  try {
    const r = await fetchJSON<any>(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=5&orientation=portrait`, { headers: { Authorization: key } });
    const p = r.photos?.[0]; if (!p) return null;
    return { url: p.src.large2x || p.src.large, source: 'pexels', credit: `${p.photographer} on Pexels`, link: p.url };
  } catch { return null; }
}

/* Pick and check images for stories that need one. `budget` caps how many new downloads a run makes. */
export async function chooseImages(stories: Stored[], cache: ImageCache, budget = 90, queryFor?: (s: Stored) => string | undefined) {
  let spent = 0;
  const spend = () => { spent++; };
  const use = (s: Stored, base: Img, ok: Checked, kind: string) => { s.image = { ...base, url: ok.url, ...(ok.w ? { w: ok.w, h: ok.h } : {}), ...(ok.lqip ? { lqip: ok.lqip } : {}), ...(ok.focus ? { focus: ok.focus } : {}) }; bump(kind); };
  // Stories with no checked image yet, or with only a fallback while a new article image has arrived
  const need = stories.filter(s => {
    const tried = new Set(s._.imgTried || []);
    return !s.image || (s.image.source !== 'article' && s.articles.some(a => a.image && !tried.has(a.image)));
  });
  await pool(need, 4, async s => {
    if (spent >= budget) return;
    const tried = new Set(s._.imgTried || []);
    const done = () => { s._.imgTried = [...tried].slice(-30); };
    // 1. The articles' own images, lead first
    for (const a of s.articles) {
      if (!a.image || tried.has(a.image)) continue;
      if (spent >= budget) return done();
      const ok = await check(a.image, cache, spend);
      if (ok) { use(s, { url: ok.url, source: 'article', credit: a.outlet, link: a.url }, ok, 'article'); return done(); }
      tried.add(a.image);
    }
    // The page's own share image
    for (const a of s.articles.slice(0, 2)) {
      if (tried.has('page:' + a.url) || spent >= budget) continue;
      tried.add('page:' + a.url);
      const page = await readPage(a.url);
      if (!page?.image || tried.has(page.image)) continue;
      const ok = await check(page.image, cache, spend);
      if (ok) { use(s, { url: ok.url, source: 'article', credit: a.outlet, link: a.url }, ok, 'og'); return done(); }
      tried.add(page.image);
    }
    if (s.image) return done();
    // 2. The main person, place or thing's Wikipedia image
    for (const e of s.entities || []) {
      if (!e.image || tried.has(e.image) || spent >= budget) continue;
      const ok = await check(e.image, cache, spend);
      if (ok) { use(s, { url: ok.url, source: 'wikimedia', credit: 'Wikimedia Commons', link: `https://en.wikipedia.org/wiki/${encodeURIComponent((e.wiki || e.name).replace(/ /g, '_'))}` }, ok, 'wikimedia'); return done(); }
      tried.add(e.image);
    }
    // 3. Stock photos, searched by the main entity or the story's interest
    const q = s.entities?.[0]?.name || queryFor?.(s);
    if (q && !tried.has('stock:' + q) && spent < budget) {
      tried.add('stock:' + q);
      const st = (await unsplash(q)) || (await pexels(q));
      if (st) {
        const ok = await check(st.url, cache, spend);
        if (ok) { use(s, st, ok, st.source); return done(); }
      }
    }
    // 4. Nothing suitable: the app draws the topic's designed cover
    bump('cover');
    done();
  });
}

export function pruneImages(cache: ImageCache) {
  const cutoff = Date.now() - 5 * 86400_000;
  for (const [k, v] of Object.entries(cache)) if (+new Date(v.at) < cutoff) delete cache[k];
}
