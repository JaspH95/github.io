import type { Story } from '../src/types';
import { tokens, similar } from '../src/similar';

const RANK: Record<string, number> = { BBC: 0, 'BBC Sport': 0, 'The Guardian': 1 };
const rank = (s: Story) => (RANK[s.outlet] ?? 5) - (s.image ? 1 : 0) * 0.5;

/* Group stories about the same event. The lead story keeps its own card; the rest become "Also covered by". */
export function cluster(stories: Story[]): Story[] {
  const groups: { toks: Set<string>; items: Story[] }[] = [];
  for (const s of stories) {
    const t = tokens(s.title);
    const g = groups.find(g => g.items.some(x => x.url === s.url) || similar(g.toks, t));
    if (g) { if (!g.items.some(x => x.url === s.url)) g.items.push(s); t.forEach(w => g.toks.add(w)); }
    else groups.push({ toks: t, items: [s] });
  }
  return groups.map(g => {
    const [lead, ...rest] = [...g.items].sort((a, b) => rank(a) - rank(b) || +new Date(b.published) - +new Date(a.published));
    const seen = new Set([lead.outlet]);
    const also = rest.filter(r => (seen.has(r.outlet) ? false : (seen.add(r.outlet), true))).map(r => ({ outlet: r.outlet, url: r.url, title: r.title }));
    return { ...lead, image: lead.image || rest.find(r => r.image)?.image, also };
  });
}
