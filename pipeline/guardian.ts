import { fetchJSON, record, normaliseUrl, stripHtml, clip } from './util';
import type { FeedItem } from './rss';

/* Guardian article bodies, kept in memory only as input for summaries. Never stored or shown. */
export const guardianBody = new Map<string, string>();

const API = 'https://content.guardianapis.com';

/* The biggest image asset up to 2000px wide (the master file is too large to hotlink) */
function bestAsset(x: any): { url: string; w: number } | undefined {
  const assets: any[] = (x.elements || []).filter((e: any) => e.relation === 'main' || e.relation === 'thumbnail').flatMap((e: any) => e.assets || []);
  const ok = assets
    .map(a => ({ url: a.file as string, w: Number(a.typeData?.width || 0), master: !!a.typeData?.isMaster }))
    .filter(a => a.url && !a.master && a.w > 0 && a.w <= 2000 && /^https:/.test(a.url))
    .sort((a, b) => b.w - a.w);
  return ok[0];
}

export async function guardianSearch(params: string, label: string, extra: Partial<FeedItem> = {}, pageSize = 25): Promise<FeedItem[]> {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) { record(label, `${API}/search?${params}`, false, 0, 'GUARDIAN_API_KEY not set'); return []; }
  const url = `${API}/search?${params}&show-fields=trailText,thumbnail,body&show-tags=keyword&show-elements=image&page-size=${pageSize}&order-by=newest&api-key=${key}`;
  const safe = url.replace(key, '***');
  try {
    const r = await fetchJSON<any>(url);
    const items: FeedItem[] = (r.response?.results || []).filter((x: any) => x.type === 'article' || x.type === 'liveblog').map((x: any, pos: number) => {
      const u = normaliseUrl(x.webUrl);
      if (x.fields?.body && x.type === 'article') guardianBody.set(u, x.fields.body);
      const big = bestAsset(x);
      return {
        title: stripHtml(x.webTitle), url: u,
        summary: clip(stripHtml(x.fields?.trailText || '')),
        image: big?.url || x.fields?.thumbnail, ...(big ? { imageW: big.w } : {}),
        published: x.webPublicationDate, outlet: 'The Guardian', pos,
        kw: [x.sectionId, ...(x.tags || []).map((t: any) => t.id)].filter(Boolean),
        ...extra,
      };
    });
    record(label, safe, items.length > 0, items.length);
    return items;
  } catch (e: any) {
    record(label, safe, false, 0, e?.message);
    return [];
  }
}

/* Interest search in the app goes through /api/interest-search, which uses the same tags endpoint */
export async function guardianTags(q: string): Promise<{ id: string; title: string; section: string }[]> {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return [];
  const r = await fetchJSON<any>(`${API}/tags?q=${encodeURIComponent(q)}&type=keyword&page-size=10&api-key=${key}`);
  return (r.response?.results || []).map((t: any) => ({ id: t.id, title: t.webTitle, section: t.sectionName }));
}
