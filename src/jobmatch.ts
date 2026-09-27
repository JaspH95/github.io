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
const STOP = new Set(['and', 'of', 'the', 'a', 'an', 'in', 'for', 'at', 'to', 'i', 'am', 'im', 'work', 'as', 'senior', 'junior', 'lead', 'head']);

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ');
const stem = (w: string) => w.replace(/ships?$/, '').replace(/(?<=[a-z]{3})s$/, '') || w;
const toks = (s: string) => norm(s).split(/\s+/).filter(w => w && !STOP.has(w));

export function makeMatcher(occ: Occupation[]) {
  const docs = occ.map(o => [o.t, ...(o.a || [])].map(s => new Set(toks(s).map(stem))));
  const df = new Map<string, number>();
  docs.forEach(d => { const all = new Set<string>(); d.forEach(s => s.forEach(w => all.add(w))); all.forEach(w => df.set(w, (df.get(w) || 0) + 1)); });
  const idf = (w: string) => Math.log((occ.length + 1) / ((df.get(w) || 0) + 1));
  const fuse = new Fuse(occ, { keys: [{ name: 't', weight: 2 }, { name: 'a', weight: 1 }], threshold: 0.35, ignoreLocation: true });

  return (query: string, n = 3): Occupation[] => {
    // Each typed word is a group of alternatives: "CRM" can match "CRM", "customer" or "relationship"
    const groups = toks(query).map(w => [...new Set((ABBR[w] ? toks(ABBR[w]) : [w]).map(stem))].filter(x => df.has(x))).filter(g => g.length);
    const weight = (g: string[]) => Math.max(...g.map(idf));
    const total = groups.reduce((s, g) => s + weight(g), 0);
    if (!groups.length || !total) return fuse.search(query, { limit: n }).map(h => h.item);
    const scored = occ.map((o, i) => {
      let best = 0;
      docs[i].forEach((d, k) => {
        let s = 0; for (const g of groups) { const hit = g.filter(w => d.has(w)); if (hit.length) s += weight(g); }
        // A match on the main title beats one on an alternative title; shorter titles are closer matches
        const v = s / total + (k === 0 ? 0.05 : 0) - d.size * 0.005;
        if (v > best) best = v;
      });
      return { o, v: best };
    }).filter(x => x.v >= 0.45).sort((a, b) => b.v - a.v).slice(0, n).map(x => x.o);
    return scored.length ? scored : fuse.search(query, { limit: n }).map(h => h.item);
  };
}
