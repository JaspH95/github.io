/* Matching text to interests. Shared by the pipeline (tagging stories) and the app (interests found by search).
   Terms with a capital letter match case-sensitively ("AI", "NHS"); lower-case terms match any case. */
import type { Interest } from './types';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface Matcher { id: string; strict?: RegExp; loose?: RegExp; guardian: string[] }

export function matcher(i: Pick<Interest, 'id' | 'match' | 'guardian'>): Matcher {
  const strict = i.match.filter(t => /[A-Z]/.test(t)).map(escapeRe);
  const loose = i.match.filter(t => !/[A-Z]/.test(t)).map(escapeRe);
  return {
    id: i.id,
    strict: strict.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${strict.join('|')})(?![\\p{L}\\p{N}])`, 'gu') : undefined,
    loose: loose.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${loose.join('|')})(?![\\p{L}\\p{N}])`, 'giu') : undefined,
    guardian: i.guardian,
  };
}

/* How many different terms appear */
function hits(m: Matcher, s: string): number {
  const found = new Set<string>();
  for (const re of [m.strict, m.loose]) if (re) for (const x of s.matchAll(re)) found.add(x[0].toLowerCase());
  return found.size;
}

/* A headline mention counts; the standfirst alone needs two different terms, or a Guardian tag */
export function matches(m: Matcher, title: string, standfirst = '', kw: string[] = []): boolean {
  if (kw.some(k => m.guardian.some(g => k === g || k.startsWith(g + '/')))) return true;
  if (hits(m, title)) return true;
  return hits(m, standfirst) >= 2;
}
