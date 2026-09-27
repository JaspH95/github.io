/* Every network call in the pipeline goes through here, so runs can be recorded and replayed.
   --record (or RECORD=1) saves each response to fixtures/; OFFLINE=1 replays them with no internet.
   Only real recorded responses are ever replayed, never invented data. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

export const UA = 'Knowfeed/1.0 (news and learning reader; contact: jasperhayward@me.com)';
const DIR = 'fixtures';
export const RECORD = process.env.RECORD === '1' || process.argv.includes('--record');
export const OFFLINE = process.env.OFFLINE === '1';

/* Keys never go into fixture names or files */
const scrub = (s: string) => s.replace(/(api[-_]?key|key|client_id|token)=[^&]+/gi, '$1=***');
const fileFor = (method: string, url: string, body?: string) =>
  `${DIR}/${createHash('sha1').update(`${method} ${scrub(url)} ${body || ''}`).digest('hex').slice(0, 20)}.json`;

export interface HttpResult { status: number; ok: boolean; text: string; url: string; headers: Record<string, string> }

export async function http(url: string, init: RequestInit & { timeout?: number } = {}): Promise<HttpResult> {
  const method = (init.method || 'GET').toUpperCase();
  const body = typeof init.body === 'string' ? init.body : undefined;
  const file = fileFor(method, url, body);
  if (OFFLINE) {
    if (!existsSync(file)) throw new Error(`offline: no recording for ${scrub(url)}`);
    const r = JSON.parse(readFileSync(file, 'utf8'));
    return { status: r.status, ok: r.status >= 200 && r.status < 300, text: r.text, url: r.url, headers: r.headers || {} };
  }
  const { timeout = 20000, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { 'User-Agent': UA, Accept: '*/*', ...(rest.headers || {}) },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });
  const text = await res.text();
  const headers: Record<string, string> = {};
  ['content-type', 'retry-after'].forEach(h => { const v = res.headers.get(h); if (v) headers[h] = v; });
  const out = { status: res.status, ok: res.ok, text, url: res.url, headers };
  if (RECORD) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(file, JSON.stringify({ ...out, url: scrub(out.url), request: `${method} ${scrub(url)}` }));
  }
  return out;
}

/* Binary downloads (images for previews and focal points) */
export async function httpBytes(url: string, timeout = 20000): Promise<Buffer> {
  const file = fileFor('BYTES', url);
  if (OFFLINE) {
    if (!existsSync(file)) throw new Error(`offline: no recording for ${scrub(url)}`);
    return Buffer.from(JSON.parse(readFileSync(file, 'utf8')).b64, 'base64');
  }
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (RECORD) { mkdirSync(DIR, { recursive: true }); writeFileSync(file, JSON.stringify({ url: scrub(url), b64: buf.toString('base64') })); }
  return buf;
}

export async function fetchText(url: string, init: RequestInit & { timeout?: number } = {}): Promise<string> {
  const r = await http(url, init);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text;
}

export async function fetchJSON<T = any>(url: string, init: RequestInit & { timeout?: number } = {}): Promise<T> {
  const text = await fetchText(url, { ...init, headers: { Accept: 'application/json', ...(init.headers || {}) } });
  return JSON.parse(text) as T;
}
