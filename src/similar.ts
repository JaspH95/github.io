/* Title similarity, shared by the pipeline (grouping stories) and the app (followed-story updates) */

const STOP = new Set(('a an the and or but of to in on at for from by with as is are was were be been has have had it its this that these those ' +
  'after before over under into out up down about than then new says said say will would could can may might not no yes more most ' +
  'how why what who when where which live latest update news uk us his her their our your you we they he she them him').split(' '));

export function tokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase().replace(/[’']s\b/g, '').replace(/[^a-z0-9£$€% ]+/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
      .map(w => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w)),
  );
}

export function similar(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  a.forEach(w => { if (b.has(w)) shared++; });
  const small = Math.min(a.size, b.size);
  if (!small) return false;
  return shared >= 3 ? shared / small >= 0.45 : shared >= 2 && small <= 3 && shared / small >= 0.66;
}

/* Names in a headline: capitalised words after the first, and numbers. Headlines written in Title Case give none. */
export function names(title: string): Set<string> {
  const words = title.replace(/[’']s\b/g, '').split(/[^\p{L}\p{N}£$€%]+/u).filter(Boolean);
  const caps = words.slice(1).filter(w => /^\p{Lu}/u.test(w));
  if (caps.length > (words.length - 1) * 0.6) return new Set(words.filter(w => /\d{2,}/.test(w)));
  return new Set([...caps.filter(w => !STOP.has(w.toLowerCase()) && w.length > 1), ...words.filter(w => /\d{2,}/.test(w))].map(w => w.toLowerCase()));
}

/* Two headlines about the same event, even from different outlets with different wording:
   very similar words, or the same two names (people, places) and a third word in common */
export interface Heads { tok: Set<string>; nm: Set<string> }
export const heads = (title: string): Heads => ({ tok: tokens(title), nm: names(title) });
export function sameEvent(a: Heads, b: Heads): boolean {
  if (similar(a.tok, b.tok)) return true;
  let n = 0; a.nm.forEach(w => { if (b.nm.has(w)) n++; });
  if (n < 2) return false;
  let t = 0; a.tok.forEach(w => { if (b.tok.has(w)) t++; });
  return t >= 3;
}
