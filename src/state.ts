import type { TopicKey } from './types';
import type { Card } from './cards';

/* Everything personal lives in this browser's localStorage */
export const load = <T>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
export const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

export interface Profile { name: string; place: string; work: string; mins: number; sports: string[]; teams: string[]; langs?: string[] }
export interface Followed { id: string; title: string; seen: string[]; at: string }
export interface WorkItem { id: string; title: string; url: string; done: boolean }

export const S = {
  liked: new Set<string>(load<string[]>('kf-liked', [])),
  later: load<Card[]>('kf-later2', []),                 // cards saved to read later (kept whole, since the data moves on)
  weights: load<Partial<Record<TopicKey, number>>>('kf-weights', {}),
  declined: new Set<TopicKey>(load<TopicKey[]>('kf-declined', [])),
  accepted: new Set<TopicKey>(load<TopicKey[]>('kf-accepted', [])),
  profile: load<Profile | null>('kf-profile3', null),
  followed: load<Followed[]>('kf-follow2', []),
  work: load<WorkItem[]>('kf-work2', []),
  seen: load<Record<string, string>>('kf-seen', {}),    // card id -> date last seen, to favour fresh cards
  quiz: { right: 0, done: 0 },
};

export const w = (t: TopicKey) => 1 + (S.weights[t] || 0);
export const isLater = (id: string) => S.later.some(c => c.id === id);

export function saveAll() {
  save('kf-weights', S.weights);
  save('kf-declined', [...S.declined]);
  save('kf-accepted', [...S.accepted]);
  save('kf-profile3', S.profile);
}
export const saveLater = () => save('kf-later2', S.later);
export const saveFollowed = () => save('kf-follow2', S.followed);
export const saveWork = () => save('kf-work2', S.work);
export const saveLiked = () => save('kf-liked', [...S.liked]);

export function markSeen(id: string) {
  S.seen[id] = today();
  // Keep a week of history
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  for (const [k, d] of Object.entries(S.seen)) if (d < cutoff) delete S.seen[k];
  save('kf-seen', S.seen);
}

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const addDays = (date: string, n: number) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
