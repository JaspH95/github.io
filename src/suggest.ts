/* Topics, people and places to follow, worked out from what you like. No AI: it counts what your liked
   stories and learning cards are about, and only suggests things with something to read today. */
import { S, persist, load, save } from './state';
import { INTERESTS, interestById, allStories, data } from './data';
import type { Story, Entity } from './types';
import { esc, toast } from './ui';

export type Suggestion =
  | { kind: 'interest'; key: string; id: string; label: string; because?: string }
  | { kind: 'entity'; key: string; name: string; label: string; because?: string; desc?: string };

const asked = () => new Set(load<string[]>('sugg-asked', []));
export function markAsked(key: string) { const a = asked(); a.add(key); save('sugg-asked', [...a].slice(-200)); }

const FOLLOWABLE: Entity['kind'][] = ['person', 'org', 'place'];
const storiesToday = () => allStories();
const newsCount = (tag: string) => storiesToday().filter(s => s.tags.includes(tag)).length + (data.learn?.cards || []).filter(c => c.interest === tag).length;
const mentions = (name: string) => { const n = name.toLowerCase(); return storiesToday().filter(s => s.entities?.some(e => e.name.toLowerCase() === n)).length; };

function likedStories(): Story[] {
  const out = new Map<string, Story>();
  for (const s of storiesToday()) if (S.liked.has(s.id)) out.set(s.id, s);
  for (const x of S.saved) if (x.story && S.liked.has(x.story.id)) out.set(x.story.id, x.story);
  return [...out.values()];
}
function likedInterests(): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of likedStories()) s.tags.forEach(t => m.set(t, (m.get(t) || 0) + 1));
  for (const c of data.learn?.cards || []) if (c.interest && S.liked.has(c.id)) m.set(c.interest, (m.get(c.interest) || 0) + 1);
  for (const [k, v] of Object.entries(S.weights)) if (interestById.has(k) && v > 0) m.set(k, (m.get(k) || 0) + v * 0.5);
  return m;
}

const isMine = (id: string) => !!S.profile?.interests.some(i => i.id === id);
const isAvoided = (id: string) => !!S.profile?.avoid.includes(id);
const interestOk = (id: string) => interestById.has(id) && !isMine(id) && !isAvoided(id) && newsCount(id) > 0;
const entityOk = (e: Entity) => (!e.kind || FOLLOWABLE.includes(e.kind)) && !S.entities.has(e.name.toLowerCase());
const interestS = (id: string, because?: string): Suggestion => ({ kind: 'interest', key: `i:${id}`, id, label: interestById.get(id)!.label, ...(because ? { because } : {}) });
const entityS = (e: Entity, because?: string): Suggestion => ({ kind: 'entity', key: `e:${e.name.toLowerCase()}`, name: e.name, label: e.name, ...(e.desc ? { desc: e.desc } : {}), ...(because ? { because } : {}) });

/* The best things to follow, most likely first */
export function suggestions(max = 6): Suggestion[] {
  if (!S.profile) return [];
  const scored: { s: Suggestion; v: number }[] = [];
  const liked = likedInterests();
  // Topics your liked stories are about that you don't follow yet
  for (const [id, n] of liked) if (interestOk(id)) scored.push({ s: interestS(id, 'from stories you liked'), v: 2 * n + Math.min(1, newsCount(id) / 5) });
  // Neighbours of topics you like (same family), if there's news about them today
  // (at most two, so they don't crowd out what you actually liked)
  const near: { s: Suggestion; v: number }[] = [];
  for (const [id, n] of liked) {
    const from = interestById.get(id); if (!from) continue;
    for (const i of INTERESTS) if (i.cat === from.cat && interestOk(i.id) && !scored.some(x => x.s.key === `i:${i.id}`) && !near.some(x => x.s.key === `i:${i.id}`)) near.push({ s: interestS(i.id, `because you like ${from.label}`), v: 0.4 * n + Math.min(0.5, newsCount(i.id) / 10) });
  }
  scored.push(...near.sort((a, b) => b.v - a.v).slice(0, 2));
  // People, places and organisations that keep coming up in stories you liked
  const ents = new Map<string, { e: Entity; n: number }>();
  for (const s of likedStories()) for (const e of s.entities || []) if (entityOk(e)) { const k = e.name.toLowerCase(); ents.set(k, { e, n: (ents.get(k)?.n || 0) + 1 }); }
  for (const { e, n } of ents.values()) { const m = mentions(e.name); if (n >= 2 || m >= 2) scored.push({ s: entityS(e, 'in stories you liked'), v: 1.2 * n + Math.min(1, m / 3) }); }
  if (!scored.length) {
    // Nothing liked yet: the topics with the most going on today
    for (const i of INTERESTS) if (interestOk(i.id)) scored.push({ s: interestS(i.id, 'lots of news today'), v: newsCount(i.id) / 10 });
  }
  return scored.sort((a, b) => b.v - a.v).slice(0, max).map(x => x.s);
}

/* Right after a like: one thing from that card worth following, if we haven't asked before */
export function afterLike(tags: string[], entities: Entity[] = []): Suggestion | null {
  if (!S.profile) return null;
  const a = asked();
  for (const t of tags) if (interestOk(t) && !a.has(`i:${t}`)) return interestS(t);
  for (const e of entities.slice(0, 4)) if (entityOk(e) && e.kind && !a.has(`e:${e.name.toLowerCase()}`) && mentions(e.name) >= 2) return entityS(e);
  return null;
}

export function follow(s: Suggestion) {
  const p = S.profile; if (!p) return;
  markAsked(s.key);
  if (s.kind === 'interest') {
    const i = interestById.get(s.id)!;
    if (!isMine(i.id)) p.interests.push({ id: i.id, label: i.label, cat: i.cat, mode: 'both' });
    p.avoid = p.avoid.filter(x => x !== i.id);
    persist.profile();
  } else {
    S.entities.add(s.name.toLowerCase());
    persist.entities();
  }
}

/* A small card above the tab bar: "Follow AI to see more of it?" */
let hideTimer: ReturnType<typeof setTimeout> | undefined;
export function offer(s: Suggestion) {
  const el = document.getElementById('suggest'); if (!el) return;
  markAsked(s.key);   // asked once, whatever the answer
  const what = s.kind === 'interest' ? `stories about <b>${esc(s.label)}</b>` : `<b>${esc(s.label)}</b> in the news`;
  el.innerHTML = `<p>Liked that? Follow ${what} to see more in your editions.</p><div><button class="sg-yes">Follow</button><button class="sg-no" aria-label="Not now">Not now</button></div>`;
  el.classList.add('show');
  const close = () => { el.classList.remove('show'); clearTimeout(hideTimer); };
  el.querySelector('.sg-yes')!.addEventListener('click', () => { follow(s); close(); toast(`Following ${s.label}. It'll shape your next edition`); });
  el.querySelector('.sg-no')!.addEventListener('click', close);
  clearTimeout(hideTimer); hideTimer = setTimeout(close, 9000);
}
