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

/* Words that are rare across today's articles ("Acropolis", "53") say more than common ones ("Trump", "police") */
const docTokens = (title: string, standfirst = '') => {
  const t = tokens(title);
  tokens(standfirst.split(/(?<=[.!?])\s/)[0] || '').forEach(w => t.add(w));
  // Specific numbers ("53 images", "£210m") are strong clues; the shared tokeniser drops short words
  for (const m of `${title} ${standfirst}`.matchAll(/\b\d[\d,.]*\d\b/g)) t.add(m[0].replace(/,/g, ''));
  return t;
};
interface Idf { df: Map<string, number>; n: number }
function buildIdf(docs: Set<string>[]): Idf {
  const df = new Map<string, number>();
  docs.forEach(d => d.forEach(w => df.set(w, (df.get(w) || 0) + 1)));
  return { df, n: Math.max(docs.length, 2) };
}
const idfOf = (w: string, x: Idf) => Math.log(x.n / (x.df.get(w) || 1));

/* How strongly two articles look like the same event: shared rare words, relative to the shorter one */
function overlap(a: Set<string>, b: Set<string>, x: Idf): { score: number; weight: number; number: boolean } {
  let weight = 0, number = false;
  a.forEach(w => { if (b.has(w)) { weight += idfOf(w, x); if (/^\d{2,}/.test(w) && !/^(19|20)\d\d$/.test(w)) number = true; } });
  const wa = [...a].reduce((s, w) => s + idfOf(w, x), 0), wb = [...b].reduce((s, w) => s + idfOf(w, x), 0);
  return { score: weight / Math.max(1, Math.min(wa, wb)), weight, number };
}

/* Score how well an article fits a story; 0 means it doesn't */
function fit(item: FeedItem, s: Stored, x: Idf): number {
  const t = tokens(item.title);
  const d = docTokens(item.title, item.summary);
  let best = 0;
  for (const a of s.articles) {
    if (similar(tokens(a.title), t)) best = Math.max(best, 2);
    const o = overlap(d, docTokens(a.title, a.standfirst), x);
    if ((o.score >= 0.25 && o.weight >= 15) || (o.score >= 0.2 && o.number)) best = Math.max(best, 1 + o.score);
  }
  return best;
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
  const idf = buildIdf([...bucket.stories.flatMap(s => s.articles.map(a => docTokens(a.title, a.standfirst))), ...items.map(i => docTokens(i.title, i.summary))]);

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
      continue;
    }
    let best: Stored | null = null, bestScore = 0;
    for (const s of bucket.stories) {
      if (+new Date(s.updated) < +new Date(it.published) - 36 * 3600_000) continue;
      const sc = fit(it, s, idf);
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
  consolidate(bucket, idf);

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

/* Stories that turn out to be the same event (once more coverage arrives) become one */
function consolidate(bucket: Bucket, idf: Idf) {
  const list = [...bucket.stories].sort((a, b) => +new Date(a.first) - +new Date(b.first));
  const gone = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (gone.has(a.id)) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (gone.has(b.id)) continue;
      if (Math.abs(+new Date(a.updated) - +new Date(b.updated)) > 36 * 3600_000) continue;
      const hit = b.articles.some(x => fit({ title: x.title, summary: x.standfirst || '', url: x.url, published: x.published, outlet: x.outlet }, a, idf) > 0);
      if (!hit) continue;
      // Fold b into a (the older one keeps its id, so follows and editions still find it)
      for (const art of b.articles) {
        const k = a.articles.findIndex(x => x.outlet === art.outlet);
        if (k < 0) a.articles.push(art);
        else if (+new Date(art.published) > +new Date(a.articles[k].published)) a.articles[k] = art;
      }
      a._.urls = [...new Set([...a._.urls, ...b._.urls])];
      a._.kw = [...new Set([...a._.kw, ...b._.kw])];
      a._.tagsFrom = [...new Set([...a._.tagsFrom, ...b._.tagsFrom])];
      for (const [o, t] of Object.entries(b._.added)) if (!a._.added[o]) a._.added[o] = t;
      a.timeline = [...(a.timeline || []), ...(b.timeline || [])].filter((t, k, arr) => arr.findIndex(x => x.url === t.url) === k)
        .sort((x, y) => +new Date(x.at) - +new Date(y.at)).slice(-8);
      if (+new Date(b.updated) > +new Date(a.updated)) a.updated = b.updated;
      if (!a.summary && b.summary) { a.summary = b.summary; a.entities = b.entities; }
      if (!a.image && b.image) a.image = b.image;
      if (b._.frontAt && (!a._.frontAt || b._.frontAt > a._.frontAt)) a._.frontAt = b._.frontAt;
      gone.add(b.id);
    }
  }
  if (gone.size) bucket.stories = bucket.stories.filter(s => !gone.has(s.id));
}

/* How many distinct outlets, how fast coverage is growing, and whether it leads a front page */
export function importance(s: Stored, now = new Date()): number {
  const outlets = new Set(s.articles.map(a => a.outlet)).size;
  const recent = Object.values(s._.added).filter(t => +new Date(t) > +now - 3 * 3600_000).length;
  const breadth = Math.min(1, (outlets - 1) / 3);
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
