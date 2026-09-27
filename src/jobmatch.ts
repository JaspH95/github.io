/* Matching a job title typed in your own words to ESCO occupations.
   Rare words count for more than common ones ("CRM" beats "manager"), common abbreviations are expanded,
   and fuzzy matching (Fuse.js) only steps in for typos. */
import Fuse from 'fuse.js';
import type { Occupation } from './types';

const ABBR: Record<string, string> = {
  crm: 'crm customer relationship relations', hubspot: 'crm customer relationship marketing', salesforce: 'crm customer relationship sales', hr: 'human resources', it: 'ict information technology', ict: 'ict information technology',
  ux: 'user experience', ui: 'user interface', pm: 'project manager', qa: 'quality assurance', seo: 'search engine optimisation',
  cto: 'chief technology officer', ceo: 'chief executive officer', cfo: 'chief financial officer', coo: 'chief operating officer',
  cmo: 'chief marketing officer', gp: 'general practitioner', dev: 'developer', devops: 'devops ict operations', ops: 'operations',
  bd: 'business development', revops: 'revenue operations sales', pr: 'public relations', sde: 'software developer', swe: 'software developer',
  exec: 'executive', mgr: 'manager', asst: 'assistant', admin: 'administrator administrative', eng: 'engineer', nhs: 'health',
};
const STOP = new Set(['and', 'of', 'the', 'a', 'an', 'in', 'for', 'at', 'to', 'i', 'am', 'im', 'work', 'as', 'senior', 'junior', 'lead', 'head',
  // Words people use when describing a job rather than naming it
  'my', 'me', 'we', 'our', 'do', 'doing', 'job', 'role', 'with', 'on', 'from', 'into', 'by', 'or', 'that', 'this', 'it', 'is', 'are', 'be', 'help', 'helping', 'people', 'company', 'companies', 'business', 'team', 'teams', 'day', 'things', 'stuff', 'lot', 'lots', 'all', 'kind', 'sort', 'basically', 'mostly', 'mainly', 'look', 'after', 'looking', 'deal', 'dealing', 'make', 'making', 'sure', 'get', 'getting']);

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ');
const stem = (w: string) => w.replace(/ships?$/, '').replace(/(?<=[a-z]{3})s$/, '') || w;
const toks = (s: string) => norm(s).split(/\s+/).filter(w => w && !STOP.has(w));

export function makeMatcher(occ: Occupation[]) {
  const docs = occ.map(o => [o.t, ...(o.a || [])].map(s => new Set(toks(s).map(stem))));
  const df = new Map<string, number>();
  docs.forEach(d => { const all = new Set<string>(); d.forEach(s => s.forEach(w => all.add(w))); all.forEach(w => df.set(w, (df.get(w) || 0) + 1)); });
  const idf = (w: string) => Math.log((occ.length + 1) / ((df.get(w) || 0) + 1));
  const fuse = new Fuse(occ, { keys: [{ name: 't', weight: 2 }, { name: 'a', weight: 1 }], threshold: 0.35, ignoreLocation: true });

  /* `boost` holds ISCO group prefixes from the areas of work someone picked: jobs in those groups rank higher */
  return (query: string, n = 6, boost: string[] = []): Occupation[] => {
    const inArea = (o: Occupation) => boost.some(b => o.g.startsWith(b));
    // Each typed word is a group of alternatives: "CRM" can match "CRM", "customer" or "relationship"
    const groups = toks(query).map(w => [...new Set((ABBR[w] ? toks(ABBR[w]) : [w]).map(stem))].filter(x => df.has(x))).filter(g => g.length);
    const weight = (g: string[]) => Math.max(...g.map(idf));
    // A description ("I run email campaigns for a charity") has more words than any title: score against its rarest few
    const total = groups.map(weight).sort((a, b) => b - a).slice(0, 4).reduce((s, w) => s + w, 0);
    const fuzzy = () => fuse.search(query, { limit: n * 2 }).map(h => h.item).sort((a, b) => +inArea(b) - +inArea(a));
    if (!groups.length || !total) return fuzzy().slice(0, n);
    const scored = occ.map((o, i) => {
      let best = 0;
      docs[i].forEach((d, k) => {
        let s = 0; for (const g of groups) { const hit = g.filter(w => d.has(w)); if (hit.length) s += weight(g); }
        // A match on the main title beats one on an alternative title; shorter titles are closer matches
        const v = Math.min(1, s / total) + (k === 0 ? 0.05 : 0) - d.size * 0.005;
        if (v > best) best = v;
      });
      return { o, v: best && best + (inArea(o) ? 0.15 : 0) };
    }).filter(x => x.v >= 0.3).sort((a, b) => b.v - a.v);
    // Strong matches first; weaker ones and typo matches only fill the gaps
    const out = scored.filter(x => x.v >= 0.45).slice(0, n).map(x => x.o);
    for (const o of [...scored.map(x => x.o), ...fuzzy()]) { if (out.length >= n) break; if (!out.includes(o)) out.push(o); }
    return out;
  };
}
