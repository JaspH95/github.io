/* People, places and things in a story, matched to their Wikipedia page for the description, photo and "Learn the background" */
import { fetchJSON, sleep } from './util';
import type { Entity } from '../src/types';

export type EntityCache = Record<string, { wiki?: string; desc?: string; image?: string; at: string }>;

const simple = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* The page must actually be about the name: its title shares the name's main words */
function plausible(name: string, title: string): boolean {
  const n = simple(name).split(' ').filter(w => w.length > 2);
  const t = simple(title);
  if (!n.length) return false;
  const shared = n.filter(w => t.includes(w)).length;
  return shared / n.length >= 0.5;
}

export async function lookup(name: string, cache: EntityCache): Promise<Partial<Entity>> {
  const k = name.toLowerCase();
  const c = cache[k];
  if (c && +new Date(c.at) > Date.now() - 30 * 86400_000) return c.wiki ? { wiki: c.wiki, desc: c.desc, image: c.image } : {};
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&generator=search&gsrsearch=${encodeURIComponent(name)}&gsrlimit=3&gsrnamespace=0&prop=pageimages|description|pageprops&piprop=thumbnail&pithumbsize=480&ppprop=disambiguation`;
  try {
    const r = await fetchJSON<any>(url);
    await sleep(120);
    const pages: any[] = (r?.query?.pages || []).sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
    const p = pages.find(p => !p.pageprops?.disambiguation && plausible(name, p.title));
    const hit = p ? { wiki: p.title as string, desc: p.description as string | undefined, image: p.thumbnail?.source as string | undefined } : {};
    cache[k] = { ...hit, at: new Date().toISOString() };
    return hit;
  } catch (e: any) {
    console.log(`  Wikipedia lookup failed for ${name}: ${e?.message}`);
    return {};
  }
}

export async function enrich(list: Entity[], cache: EntityCache): Promise<Entity[]> {
  const out: Entity[] = [];
  for (const e of list) {
    const w = await lookup(e.name, cache);
    out.push({ ...e, ...(w.wiki ? { wiki: w.wiki } : {}), ...(w.desc ? { desc: w.desc } : {}), ...(w.image ? { image: w.image } : {}) });
  }
  return out;
}

export function pruneEntities(cache: EntityCache) {
  const cutoff = Date.now() - 30 * 86400_000;
  for (const [k, v] of Object.entries(cache)) if (+new Date(v.at) < cutoff) delete cache[k];
}
