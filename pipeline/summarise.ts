/* AI summaries with the Gemini API free tier. Pipeline only: never called from the phone.
   Written only from the articles' own text, then checked: numbers and names must appear in the text,
   no long quotes, within word limits. Anything that fails falls back to the lead outlet's standfirst. */
import { http } from './http';
import { fetchJSON, sleep } from './util';
import type { Summary, Quote, Entity } from '../src/types';

const API = 'https://generativelanguage.googleapis.com/v1beta';

export const PROMPT = `Using only the articles below, write: (1) three bullet takeaways of max 15 words each, and (2) up to three short sections titled "What happened", "Why it matters", "What happens next". Skip any section the articles don't support. British English, plain and neutral. Don't add facts, names or numbers that aren't in the articles. Don't quote more than 10 words in a row. Where outlets disagree, say so briefly. Keep the sections to 150 words in total. Return JSON.

Also return:
- "fivew": one short sentence each for who, what, when, where and why, only where the articles say so (empty string otherwise).
- "quotes": up to two direct quotes that appear word for word in the articles, with the speaker's name and role as the articles give them (empty list if none).
- "entities": up to five people, places or organisations central to the story, spelled exactly as in the articles, each with kind "person", "place", "org" or "thing".`;

const HEADINGS = ['What happened', 'Why it matters', 'What happens next'];

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    gist: { type: 'ARRAY', items: { type: 'STRING' } },
    sections: { type: 'ARRAY', items: { type: 'OBJECT', properties: { heading: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['heading', 'text'] } },
    fivew: { type: 'OBJECT', properties: { who: { type: 'STRING' }, what: { type: 'STRING' }, when: { type: 'STRING' }, where: { type: 'STRING' }, why: { type: 'STRING' } } },
    quotes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, who: { type: 'STRING' }, role: { type: 'STRING' } }, required: ['text', 'who'] } },
    entities: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kind: { type: 'STRING' } }, required: ['name'] } },
  },
  required: ['gist', 'sections'],
};

/* ---------- Choosing a model the free tier can use ---------- */

/* Flash models, newest first, with the lighter variant after each. A model that hits its daily
   free quota is skipped for the rest of the run, and the next one is tried. */
export async function modelList(key: string): Promise<string[]> {
  const pinned = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [];
  let found: string[] = [];
  try {
    const res = await fetchJSON<{ models: { name: string; supportedGenerationMethods?: string[] }[] }>(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    found = res.models.filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
  } catch (e: any) {
    console.log(`  could not list Gemini models: ${e?.message || e}`);
  }
  const ver = (n: string) => parseFloat(n.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] || '0');
  const stable = found.filter(n => /^gemini-\d+(?:\.\d+)?-flash(?:-lite)?$/.test(n))
    .sort((a, b) => ver(b) - ver(a) || (a.endsWith('-lite') ? 1 : 0) - (b.endsWith('-lite') ? 1 : 0));
  const latest = ['gemini-flash-latest', 'gemini-flash-lite-latest'].filter(n => found.includes(n));
  const list = [...new Set([...pinned, ...stable, ...latest])];
  return list.length ? list : ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
}

type CallResult = { ok: true; text: string } | { ok: false; kind: 'daily' | 'minute' | 'busy' | 'empty' | 'other'; wait?: number; detail: string };

async function call(key: string, model: string, prompt: string): Promise<CallResult> {
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
  });
  let r;
  try {
    r = await http(`${API}/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, timeout: 90000 });
  } catch (e: any) {
    return { ok: false, kind: 'busy', detail: e?.message || String(e) };
  }
  if (r.ok) {
    try {
      const data = JSON.parse(r.text);
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
      return text ? { ok: true, text } : { ok: false, kind: 'empty', detail: `empty reply (${data?.candidates?.[0]?.finishReason || 'no candidates'})` };
    } catch { return { ok: false, kind: 'empty', detail: 'unreadable reply' }; }
  }
  let err: any = {};
  try { err = JSON.parse(r.text).error || {}; } catch { /* not JSON */ }
  const details: any[] = err.details || [];
  const quotaIds: string[] = details.flatMap(d => (d.violations || []).map((v: any) => v.quotaId || v.quotaMetric || '')).filter(Boolean);
  const retry = details.find(d => String(d['@type'] || '').includes('RetryInfo'))?.retryDelay;
  const wait = retry ? Math.ceil(parseFloat(retry)) : undefined;
  const detail = `HTTP ${r.status} ${quotaIds.join(',') || String(err.message || '').slice(0, 120)}`;
  if (r.status === 429) {
    const daily = quotaIds.some(q => /PerDay/i.test(q)) || (!quotaIds.some(q => /PerMinute/i.test(q)) && /quota/i.test(err.message || '') && (wait === undefined || wait > 90));
    return { ok: false, kind: daily ? 'daily' : 'minute', wait, detail };
  }
  if (r.status === 503 || r.status === 500 || r.status === 504) return { ok: false, kind: 'busy', detail };
  return { ok: false, kind: 'other', detail };
}

/* ---------- Checking the output ---------- */

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function checkText(all: string, source: string): string | null {
  const src = norm(source);
  const srcDigits = src.replace(/[,\s]/g, '');
  // Numbers must appear in the articles (ignoring thousands separators)
  for (const n of all.match(/\d[\d,.]*/g) || []) {
    const bare = n.replace(/[,.]+$/, '').replace(/,/g, '');
    if (bare && !srcDigits.includes(bare)) return `number ${n} not in text`;
  }
  // Capitalised words that aren't starting a sentence must appear in the articles
  const ws = all.split(/\s+/);
  for (let i = 1; i < ws.length; i++) {
    const w = ws[i].replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, '');
    const prev = ws[i - 1];
    if (!w || !/^\p{Lu}/u.test(w) || /[.!?:"“]$/.test(prev)) continue;
    const base = norm(w).replace(/['’]s$/, '');
    if (base.length > 1 && !src.includes(base)) return `name "${w}" not in text`;
  }
  // No run of 11+ words copied from the articles
  const sw = norm(all).replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);
  const srcFlat = ' ' + src.replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ') + ' ';
  for (let i = 0; i + 11 <= sw.length; i++) {
    if (srcFlat.includes(' ' + sw.slice(i, i + 11).join(' ') + ' ')) return 'quotes more than 10 words in a row';
  }
  return null;
}

const flat = (s: string) => ' ' + norm(s).replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';

export interface Checked { summary: Omit<Summary, 'model' | 'at' | 'n'>; entities: Entity[]; notes: string[] }

export function check(raw: any, source: string): Checked | string {
  const notes: string[] = [];
  const gist = (Array.isArray(raw?.gist) ? raw.gist : []).map((g: any) => String(g || '').replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  const okGist = gist.filter((g: string) => words(g) <= 16);
  if (okGist.length < gist.length) notes.push('dropped long takeaway');
  const sections = (Array.isArray(raw?.sections) ? raw.sections : [])
    .map((s: any) => ({ heading: String(s?.heading || '').trim(), text: String(s?.text || '').trim() }))
    .filter((s: any) => HEADINGS.includes(s.heading) && s.text)
    .filter((s: any, i: number, a: any[]) => a.findIndex(x => x.heading === s.heading) === i)
    .sort((a: any, b: any) => HEADINGS.indexOf(a.heading) - HEADINGS.indexOf(b.heading))
    .slice(0, 3);
  if (!okGist.length || !sections.length) return 'missing takeaways or sections';
  if (words(sections.map((s: any) => s.text).join(' ')) > 170) return 'too long';
  const problem = checkText([...okGist, ...sections.map((s: any) => s.text)].join(' '), source);
  if (problem) return problem;

  // The five Ws: keep the ones that pass the same checks
  let fivew: [string, string][] | undefined;
  if (raw?.fivew && typeof raw.fivew === 'object') {
    const pairs = (['who', 'what', 'when', 'where', 'why'] as const)
      .map(k => [k[0].toUpperCase() + k.slice(1), String(raw.fivew[k] || '').trim()] as [string, string])
      .filter(([, v]) => v && words(v) <= 40 && !checkText(v, source));
    if (pairs.length >= 3) fivew = pairs;
  }
  // Quotes must appear word for word, and the speaker must be named in the articles
  const src = flat(source);
  const quotes: Quote[] = (Array.isArray(raw?.quotes) ? raw.quotes : [])
    .map((q: any) => ({ text: String(q?.text || '').trim().replace(/^["“'‘]+|["”'’]+$/g, ''), who: String(q?.who || '').trim(), role: String(q?.role || '').trim() }))
    .filter((q: Quote) => words(q.text) >= 4 && words(q.text) <= 40 && q.who && src.includes(flat(q.text)) && src.includes(flat(q.who)))
    .map((q: Quote) => ({ text: q.text, who: q.who, ...(q.role && src.includes(flat(q.role)) ? { role: q.role } : {}) }))
    .slice(0, 2);
  const kinds = ['person', 'place', 'org', 'thing'];
  const entities: Entity[] = (Array.isArray(raw?.entities) ? raw.entities : [])
    .map((e: any) => ({ name: String(e?.name || '').trim(), kind: kinds.includes(e?.kind) ? e.kind : undefined }))
    .filter((e: Entity) => e.name.length > 1 && e.name.length < 60 && src.includes(flat(e.name)))
    .filter((e: Entity, i: number, a: Entity[]) => a.findIndex(x => x.name.toLowerCase() === e.name.toLowerCase()) === i)
    .slice(0, 5);
  return { summary: { gist: okGist.slice(0, 3), sections, ...(fivew ? { fivew } : {}), ...(quotes.length ? { quotes } : {}) }, entities, notes };
}

/* ---------- Summarising ---------- */

export interface Source { outlet: string; title: string; text: string; url: string }

export class Summariser {
  private models: string[] = [];
  private out = new Set<string>();             // models that hit their daily quota this run
  private busy = new Map<string, number>();
  private lastCall = 0;
  used = new Set<string>();
  notes: string[] = [];
  constructor(private key: string) {}

  async init() { this.models = await modelList(this.key); console.log(`Gemini models to try: ${this.models.join(', ')}`); }
  get available() { return this.models.filter(m => !this.out.has(m) && (this.busy.get(m) || 0) < 3); }

  /* Returns the checked summary, 'transient' when every model was busy or out of quota, or 'failed' */
  async run(title: string, sources: Source[]): Promise<{ summary: Summary; entities: Entity[] } | 'transient' | 'failed'> {
    const budget = 20000;
    const per = Math.floor(budget / sources.length);
    const body = sources.map((s, i) => `--- Article ${i + 1}: ${s.outlet} ---\nHeadline: ${s.title}\n${s.text.slice(0, per)}`).join('\n\n');
    const source = sources.map(s => `${s.outlet}. ${s.title}. ${s.text}`).join('\n');
    const prompt = `${PROMPT}\n\nStory: ${title}\n\n${body}`;
    for (const model of this.available) {
      for (let attempt = 0; attempt < 3; attempt++) {
        // Free tier limits are per minute: space calls out
        const gap = Number(process.env.GEMINI_GAP_MS || 6500);
        const wait = this.lastCall + gap - Date.now();
        if (wait > 0) await sleep(wait);
        this.lastCall = Date.now();
        const r = await call(this.key, model, prompt);
        if (r.ok) {
          this.busy.set(model, 0);
          let parsed: any;
          try { parsed = JSON.parse(r.text); } catch { console.log(`  ${model}: reply wasn't JSON`); return 'failed'; }
          const c = check(parsed, `${title}\n${source}`);
          if (typeof c === 'string') { console.log(`  summary rejected (${c}): ${title}`); return 'failed'; }
          this.used.add(model);
          return { summary: { ...c.summary, model, at: new Date().toISOString(), n: sources.length }, entities: c.entities };
        }
        console.log(`  ${model}: ${r.kind} ${r.detail}`);
        if (r.kind === 'daily') { this.out.add(model); this.notes.push(`${model} reached its daily free quota`); break; }
        if (r.kind === 'minute') { await sleep(Math.min(65, r.wait ?? 30) * 1000); continue; }
        if (r.kind === 'busy') { this.busy.set(model, (this.busy.get(model) || 0) + 1); await sleep(4000 * (attempt + 1)); if ((this.busy.get(model) || 0) >= 3) break; continue; }
        if (r.kind === 'empty') return 'failed';
        // Anything else (a model that rejects the request): try the next model
        this.out.add(model); this.notes.push(`${model}: ${r.detail}`); break;
      }
    }
    return 'transient';
  }
}
