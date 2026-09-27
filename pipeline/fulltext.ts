import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import robotsParser from 'robots-parser';
import { fetchText, UA } from './util';

/* Full article text is used only as input to the summary. It is never stored or displayed. */

const robotsCache = new Map<string, ReturnType<typeof robotsParser> | null>();

export async function allowed(url: string): Promise<boolean> {
  const origin = new URL(url).origin;
  if (!robotsCache.has(origin)) {
    try {
      const txt = await fetchText(origin + '/robots.txt', { timeout: 10000 });
      robotsCache.set(origin, robotsParser(origin + '/robots.txt', txt));
    } catch {
      robotsCache.set(origin, null); // no robots.txt reachable: treat as allowed
    }
  }
  const r = robotsCache.get(origin);
  return r ? r.isAllowed(url, UA) !== false : true;
}

export interface Page { text: string | null; image?: string; description?: string }

/* One fetch gives the readable text (for summaries) and the page's share image and description */
const pages = new Map<string, Promise<Page | null>>();
export function readPage(url: string): Promise<Page | null> {
  if (!pages.has(url)) pages.set(url, load(url));
  return pages.get(url)!;
}

async function load(url: string): Promise<Page | null> {
  try {
    if (!(await allowed(url))) { console.log(`  robots.txt disallows ${url}`); return null; }
    const html = await fetchText(url, { timeout: 20000, headers: { Accept: 'text/html' } });
    const vc = new VirtualConsole(); // silence CSS parse noise
    const dom = new JSDOM(html, { url, virtualConsole: vc });
    const doc = dom.window.document;
    const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content')?.trim() || undefined;
    const image = meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]') || meta('meta[property="og:image:url"]');
    const description = meta('meta[property="og:description"]') || meta('meta[name="description"]');
    const art = new Readability(doc).parse();
    dom.window.close();
    const text = (art?.textContent || '').replace(/\s+/g, ' ').trim();
    return { text: text.length > 400 ? text : null, ...(image && /^https?:/.test(image) ? { image: new URL(image, url).toString() } : {}), ...(description ? { description } : {}) };
  } catch (e: any) {
    console.log(`  page fetch failed ${url}: ${e?.message || e}`);
    return null;
  }
}

export async function extractText(url: string): Promise<string | null> {
  return (await readPage(url))?.text ?? null;
}

export function htmlToText(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  const t = dom.window.document.body.textContent || '';
  dom.window.close();
  return t.replace(/\s+/g, ' ').trim();
}
