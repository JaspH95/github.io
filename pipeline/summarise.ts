import { fetchJSON, sleep } from './util';
import type { Summary } from '../src/types';

const API = 'https://generativelanguage.googleapis.com/v1beta';

const PROMPT = `Summarise this news article for a busy reader. Use only information in the article text below. Do not add facts, names, numbers or context that aren't in the text. Write in British English, in plain, short sentences. Give up to three short sections with these headings, skipping any the text doesn't support: "What happened", "Why it matters", "What happens next". Maximum 150 words. Do not quote more than 10 words in a row from the article.

Reply as JSON: {"sections":[{"heading":"What happened","text":"..."}]}`;

const HEADINGS = ['What happened', 'Why it matters', 'What happens next'];

/* Pick the newest stable Flash model this key can use, unless GEMINI_MODEL says otherwise */
export async function pickModel(key: string): Promise<string> {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  try {
    const res = await fetchJSON<{ models: { name: string; supportedGenerationMethods?: string[] }[] }>(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    const usable = res.models.filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
    const stable = usable
      .map(n => ({ n, m: n.match(/^gemini-(\d+(?:\.\d+)?)-flash$/) }))
      .filter(x => x.m)
      .sort((a, b) => parseFloat(b.m![1]) - parseFloat(a.m![1]));
    if (stable[0]) return stable[0].n;
    if (usable.includes('gemini-flash-latest')) return 'gemini-flash-latest';
  } catch (e: any) {
    console.log(`  could not list Gemini models: ${e?.message || e}`);
  }
  return 'gemini-2.5-flash';
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'");

/* Reject summaries that bring in names or numbers the article doesn't contain, or copy long runs of it */
export function checkSummary(sections: { heading: string; text: string }[], source: string): string | null {
  const src = norm(source);
  const srcDigits = src.replace(/[,\s]/g, '');
  const all = sections.map(s => s.text).join(' ');
  // Numbers must appear in the article (ignoring thousands separators)
  for (const n of all.match(/\d[\d,.]*/g) || []) {
    const bare = n.replace(/[,.]+$/, '').replace(/,/g, '');
    if (bare && !srcDigits.includes(bare)) return `number ${n} not in text`;
  }
  // Capitalised words that aren't starting a sentence must appear in the article
  const words = all.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, '');
    const prev = words[i - 1];
    if (!w || !/^\p{Lu}/u.test(w) || /[.!?:"“]$/.test(prev)) continue;
    const base = norm(w).replace(/['’]s$/, '');
    if (base.length > 1 && !src.includes(base)) return `name "${w}" not in text`;
  }
  // No run of 11+ words copied from the article
  const sw = norm(all).replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);
  const srcFlat = ' ' + src.replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ') + ' ';
  for (let i = 0; i + 11 <= sw.length; i++) {
    if (srcFlat.includes(' ' + sw.slice(i, i + 11).join(' ') + ' ')) return 'quotes more than 10 words in a row';
  }
  if (all.split(/\s+/).length > 190) return 'too long';
  return null;
}

let lastCall = 0;
export async function summarise(key: string, model: string, title: string, text: string): Promise<Summary | null> {
  // Free tier rate limits are per minute: space calls out
  const gap = Number(process.env.GEMINI_GAP_MS || 6500);
  const wait = lastCall + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const body = {
    contents: [{ role: 'user', parts: [{ text: `${PROMPT}\n\nHeadline: ${title}\n\nArticle text:\n${text.slice(0, 12000)}` }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { sections: { type: 'ARRAY', items: { type: 'OBJECT', properties: { heading: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['heading', 'text'] } } },
        required: ['sections'],
      },
    },
  };
  try {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) { console.log(`  Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`); return null; }
    const data: any = await res.json();
    const out = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    const parsed = JSON.parse(out);
    const sections = (parsed.sections || [])
      .map((s: any) => ({ heading: String(s.heading || '').trim(), text: String(s.text || '').trim() }))
      .filter((s: any) => HEADINGS.includes(s.heading) && s.text)
      .slice(0, 3);
    if (!sections.length) return null;
    const problem = checkSummary(sections, `${title} ${text}`);
    if (problem) { console.log(`  summary rejected (${problem}): ${title}`); return null; }
    return { sections, model };
  } catch (e: any) {
    console.log(`  Gemini failed: ${e?.message || e}`);
    return null;
  }
}
