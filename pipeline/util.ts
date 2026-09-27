import { createHash } from 'node:crypto';
import type { SourceStatus } from '../src/types';

export { UA, fetchText, fetchJSON } from './http';

export const status: SourceStatus[] = [];
export function record(name: string, url: string, ok: boolean, items: number, error?: string) {
  status.push({ name, url, ok, items, ...(error ? { error } : {}) });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${items})${error ? ' ' + error : ''}`);
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);

export function normaliseUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    ['at_medium', 'at_campaign', 'at_link_origin', 'at_ptr_name', 'at_link_id', 'at_link_type', 'at_format', 'at_bbc_team', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'CMP'].forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch { return u; }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', pound: '£', euro: '€' };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripHtml(s: string): string {
  return decodeEntities(String(s || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function clip(s: string, max = 280): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '') + '…';
}

export function todayUTC(d = new Date()): string { return d.toISOString().slice(0, 10); }

/* Run tasks with limited concurrency */
export async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all([...Array(Math.min(n, items.length))].map(async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}
