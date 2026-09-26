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
