/* Stories persist between hourly runs, so each one knows when it was first seen, how coverage grew,
   and what changed. Articles about the same event are grouped by title similarity plus shared names. */
import { hash, clip } from './util';
import { tokens, similar } from '../src/similar';
import { matcher, matches, type Matcher } from '../src/match';
import type { FeedItem } from './rss';
import type { Story, Article, TopicKey, Interest } from '../src/types';

/* Pipeline-only bookkeeping, stripped before the story is written to public/data */
export interface Meta {
  urls: string[];                         // every article URL ever grouped into the story
  added: Record<string, string>;          // outlet -> when it first appeared in this story
  kw: string[];
  tagsFrom: string[];
  frontAt?: string;                       // last time it led a front page
  sumTried?: string;                      // last summary attempt
  sumFail?: 'perm' | 'transient';
  imgTried?: string[];                    // image URLs already checked and rejected
}
export type Stored = Story & { _: Meta };
export interface Bucket { stories: Stored[] }

/* Outlets whose version leads when several cover a story */
const RANK: Record<string, number> = { 'BBC News': 0, 'BBC Sport': 0, 'The Guardian': 1 };
const rank = (a: Article) => (RANK[a.outlet] ?? 5) - (a.image ? 0.5 : 0);

/* Capitalised names in a headline and standfirst ("Keir Starmer", "Bank of England"), used to help grouping */
const NAME_STOP = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'Why', 'How', 'What', 'Who', 'When', 'Where', 'Watch', 'Live', 'Analysis', 'Opinion', 'Review', 'I', 'We', 'It', 'This', 'That', 'He', 'She', 'They', 'After', 'Before', 'New', 'UK', 'US']);
export function names(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.matchAll(/\b([A-Z][\p{L}'’-]+(?:\s+(?:of|the|and|de|von)?\s*[A-Z][\p{L}'’-]+)*)/gu)) {
    const n = m[1].replace(/['’]s$/, '').trim();
    if (n.length > 2 && !NAME_STOP.has(n)) out.add(n.toLowerCase());
  }
  return out;
}

function storyTokens(s: Stored): Set<string> {
  const t = new Set<string>();
  s.articles.forEach(a => tokens(a.title).forEach(w => t.add(w)));
  return t;
}
function storyNames(s: Stored): Set<string> {
  const t = new Set<string>();
  s.articles.forEach(a => names(`${a.title} ${a.standfirst || ''}`).forEach(w => t.add(w)));
  return t;
}

/* Score how well an article fits a story; 0 means it doesn't */
function fit(item: FeedItem, s: Stored, cache: Map<string, { t: Set<string>; n: Set<string> }>): number {
  let c = cache.get(s.id);
  if (!c) { c = { t: storyTokens(s), n: storyNames(s) }; cache.set(s.id, c); }
  const t = tokens(item.title);
  const n = names(`${item.title} ${item.summary}`);
  let sharedT = 0; t.forEach(w => c!.t.has(w) && sharedT++);
  let sharedN = 0; n.forEach(w => c!.n.has(w) && sharedN++);
  // Compare with each article's title too: the union of many titles makes accidental overlap likelier
  const titleMatch = s.articles.some(a => similar(tokens(a.title), t));
  if (titleMatch) return 2 + sharedN * 0.1 + sharedT * 0.05;
  if (sharedN >= 2 && sharedT >= 3) return 1 + sharedN * 0.1;
  return 0;
}

let MATCHERS: Matcher[] = [];
export function setInterests(list: Interest[]) { MATCHERS = list.map(matcher); }

export function tagsFor(title: string, standfirst: string, kw: string[] = []): string[] {
  return MATCHERS.filter(m => matches(m, title, standfirst, kw)).map(m => m.id);
}

const toArticle = (i: FeedItem): Article => ({
  outlet: i.outlet, url: i.url, title: i.title,
  ...(i.summary ? { standfirst: i.summary } : {}),
  published: i.published,
  ...(i.image ? { image: i.image } : {}),
});

export interface MergeOptions { topic: TopicKey; tag?: string; keepHours: number; now?: Date; frontUrls?: Set<string> }

/* Fold this run's articles into the bucket's stories */
export function merge(bucket: Bucket, items: FeedItem[], opt: MergeOptions): Stored[] {
  const now = opt.now || new Date();
  const nowIso = now.toISOString();
  const cutoff = +now - opt.keepHours * 3600_000;
  const byUrl = new Map<string, Stored>();
  bucket.stories.forEach(s => s._.urls.forEach(u => byUrl.set(u, s)));
  const cache = new Map<string, { t: Set<string>; n: Set<string> }>();

  // Oldest first, so a story's first article is its earliest
  const sorted = [...items].filter(i => +new Date(i.published) >= cutoff).sort((a, b) => +new Date(a.published) - +new Date(b.published));
  for (const it of sorted) {
    const known = byUrl.get(it.url);
    if (known) {
      // The same article again (maybe from another feed): refresh its details
      const a = known.articles.find(x => x.url === it.url);
      if (a) { a.title = it.title; if (it.summary) a.standfirst = it.summary; if (it.image && (!a.image || (it.imageW || 0) > 0)) a.image = it.image; }
      known._.kw = [...new Set([...known._.kw, ...(it.kw || [])])];
      known._.tagsFrom = [...new Set([...known._.tagsFrom, ...(it.tags || [])])];
      if (it.topic && known.topic === opt.topic) known.topic = it.topic;
      cache.delete(known.id);
      continue;
    }
    let best: Stored | null = null, bestScore = 0;
    for (const s of bucket.stories) {
      if (+new Date(s.updated) < +new Date(it.published) - 36 * 3600_000) continue;
      const sc = fit(it, s, cache);
      if (sc > bestScore) { best = s; bestScore = sc; }
    }
    if (best) {
      const s = best;
      s._.urls.push(it.url); byUrl.set(it.url, s);
      s._.kw = [...new Set([...s._.kw, ...(it.kw || [])])];
      s._.tagsFrom = [...new Set([...s._.tagsFrom, ...(it.tags || [])])];
      const sameOutlet = s.articles.findIndex(a => a.outlet === it.outlet);
      const art = toArticle(it);
      // One article per outlet in the coverage list: the newest
      if (sameOutlet >= 0) { if (+new Date(it.published) >= +new Date(s.articles[sameOutlet].published)) s.articles[sameOutlet] = art; }
      else { s.articles.push(art); s._.added[it.outlet] = nowIso; }
      // What changed, and when: later coverage becomes the timeline
      if (+new Date(it.published) > +new Date(s.first) + 30 * 60_000) {
        s.timeline = [...(s.timeline || []), { at: it.published, text: it.title, outlet: it.outlet, url: it.url }]
          .sort((a, b) => +new Date(a.at) - +new Date(b.at)).slice(-8);
      }
      if (+new Date(it.published) > +new Date(s.updated)) s.updated = it.published;
      cache.delete(s.id);
      continue;
    }
    const s: Stored = {
      id: hash(it.url), title: it.title, standfirst: it.summary, url: it.url, outlet: it.outlet, published: it.published,
      first: it.published < nowIso ? it.published : nowIso, updated: it.published,
      topic: it.topic || opt.topic, tags: [], ...(opt.tag ? { tag: opt.tag } : {}),
      articles: [toArticle(it)], importance: 0,
      timeline: [{ at: it.published, text: it.title, outlet: it.outlet, url: it.url }],
      _: { urls: [it.url], added: { [it.outlet]: nowIso }, kw: it.kw || [], tagsFrom: it.tags || [] },
    };
    bucket.stories.push(s); byUrl.set(it.url, s);
  }

  // Forget stories that have gone quiet
  bucket.stories = bucket.stories.filter(s => +new Date(s.updated) >= cutoff);

  for (const s of bucket.stories) {
    s.articles.sort((a, b) => rank(a) - rank(b) || +new Date(b.published) - +new Date(a.published));
    const lead = s.articles[0];
    s.title = lead.title; s.standfirst = clip(lead.standfirst || s.articles.find(a => a.standfirst)?.standfirst || '', 320);
    s.url = lead.url; s.outlet = lead.outlet; s.published = lead.published;
    s.articles = s.articles.slice(0, 12);
    const text = s.articles.map(a => a.title).join(' · ');
    s.tags = [...new Set([...s._.tagsFrom, ...tagsFor(text, s.standfirst, s._.kw)])];
    const kw = s._.kw.filter(k => k.includes('/'));
    if (kw.length) s.kw = kw.slice(0, 20); else delete s.kw;
    if (opt.frontUrls && s._.urls.some(u => opt.frontUrls!.has(u))) s._.frontAt = nowIso;
    s.top = !!s._.frontAt && +new Date(s._.frontAt) > +now - 3 * 3600_000;
    s.importance = importance(s, now);
  }
  return bucket.stories;
}

/* How many distinct outlets, how fast coverage is growing, and whether it leads a front page */
export function importance(s: Stored, now = new Date()): number {
  const outlets = new Set(s.articles.map(a => a.outlet)).size;
  const recent = Object.values(s._.added).filter(t => +new Date(t) > +now - 3 * 3600_000).length;
  const breadth = Math.min(1, (outlets - 1) / 4);
  const growth = Math.min(1, recent / 3);
  const v = 0.55 * breadth + 0.2 * growth + 0.25 * (s.top ? 1 : 0);
  return Math.round(v * 100) / 100;
}

/* What the app gets: no bookkeeping, no empty fields */
export function publicStory(s: Stored): Story {
  const { _, ...rest } = s;
  const out: Story = { ...rest };
  if (!out.timeline || out.timeline.length < 2) delete out.timeline;
  if (!out.top) delete out.top;
  return out;
}
