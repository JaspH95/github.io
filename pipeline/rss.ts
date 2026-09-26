import { XMLParser } from 'fast-xml-parser';
import { fetchText, normaliseUrl, stripHtml, clip, record, hash, decodeEntities } from './util';
import type { Story, TopicKey } from '../src/types';

export interface FeedItem { title: string; url: string; summary: string; image?: string; published: string; outlet: string }

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', htmlEntities: false, processEntities: false });
/* Entities are decoded by stripHtml/decodeEntities instead: some feeds (HubSpot) exceed the parser's entity limit */

const arr = <T>(x: T | T[] | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const txt = (x: any): string => (x == null ? '' : typeof x === 'object' ? String(x['#text'] ?? '') : String(x));
const link = (s: string) => decodeEntities(s.trim());

/* BBC thumbnails come at 240px; the same image server serves larger sizes */
function upscale(u?: string): string | undefined {
  if (!u) return u;
  return u.replace(/(ichef\.bbci\.co\.uk\/(?:ace\/standard|news))\/\d+\//, '$1/976/');
}

function imageFrom(it: any): string | undefined {
  const cands: string[] = [];
  arr(it['media:thumbnail']).forEach((m: any) => m?.['@url'] && cands.push(m['@url']));
  arr(it['media:content']).forEach((m: any) => {
    if (m?.['@url'] && (!m['@medium'] || m['@medium'] === 'image') && !/\.(mp4|mp3)$/i.test(m['@url'])) cands.push(m['@url']);
    arr(m?.['media:thumbnail']).forEach((t: any) => t?.['@url'] && cands.push(t['@url']));
  });
  arr(it['media:group']).forEach((g: any) => arr(g?.['media:content']).forEach((m: any) => m?.['@url'] && cands.push(m['@url'])));
  arr(it.enclosure).forEach((e: any) => e?.['@url'] && /^image\//.test(e['@type'] || 'image/') && cands.push(e['@url']));
  const html = txt(it['content:encoded']) || txt(it.content) || txt(it.description) || txt(it.summary);
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) cands.push(m[1]);
  // Prefer the largest-looking candidate (media:content is usually bigger than the thumbnail)
  const best = cands.find(u => !/thumb|\/\d{2,3}x\d{2,3}/i.test(u)) || cands[0];
  return upscale(best ? decodeEntities(best) : undefined);
}

export function parseFeed(xml: string, outlet: string): FeedItem[] {
  const doc = parser.parse(xml);
  const items: FeedItem[] = [];
  if (doc.rss || doc['rdf:RDF']) {
    const ch = doc.rss?.channel ?? doc['rdf:RDF'];
    const list = arr(ch?.item ?? doc['rdf:RDF']?.item);
    for (const it of list) {
      const url = txt(it.link) || txt(it.guid);
      items.push({
        title: stripHtml(txt(it.title)),
        url: normaliseUrl(link(url)),
        summary: clip(stripHtml(txt(it.description) || txt(it['content:encoded']))),
        image: imageFrom(it),
        published: toISO(txt(it.pubDate) || txt(it['dc:date'])),
        outlet,
      });
    }
  } else if (doc.feed) {
    for (const it of arr(doc.feed.entry)) {
      const links = arr(it.link);
      const lk = links.find((l: any) => !l['@rel'] || l['@rel'] === 'alternate') ?? links[0];
      items.push({
        title: stripHtml(txt(it.title)),
        url: normaliseUrl(link(String(lk?.['@href'] ?? ''))),
        summary: clip(stripHtml(txt(it.summary) || txt(it.content))),
        image: imageFrom(it),
        published: toISO(txt(it.published) || txt(it.updated)),
        outlet,
      });
    }
  }
  return items.filter(i => i.title && /^https?:/.test(i.url));
}

function toISO(s: string): string {
  const d = new Date(s);
  return isNaN(+d) ? new Date().toISOString() : d.toISOString();
}

export async function getFeed(name: string, url: string, outlet: string): Promise<FeedItem[]> {
  try {
    const xml = await fetchText(url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
    const items = parseFeed(xml, outlet);
    record(name, url, items.length > 0, items.length, items.length ? undefined : `no items (response starts: ${xml.slice(0, 120).replace(/\s+/g, ' ')})`);
    return items;
  } catch (e: any) {
    record(name, url, false, 0, e?.message || String(e));
    return [];
  }
}

export function toStory(it: FeedItem, topic: TopicKey, tag?: string): Story {
  return {
    id: hash(it.url),
    title: it.title,
    standfirst: it.summary,
    url: it.url,
    outlet: it.outlet,
    ...(it.image ? { image: it.image } : {}),
    published: it.published,
    topic,
    ...(tag ? { tag } : {}),
    also: [],
  };
}

/* Keep items from the last `hours`, newest first, de-duplicated by URL */
export function fresh(items: FeedItem[], hours = 48, max = 30): FeedItem[] {
  const cutoff = Date.now() - hours * 3600_000;
  const seen = new Set<string>();
  return items
    .filter(i => +new Date(i.published) >= cutoff)
    .sort((a, b) => +new Date(b.published) - +new Date(a.published))
    .filter(i => (seen.has(i.url) ? false : (seen.add(i.url), true)))
    .slice(0, max);
}
