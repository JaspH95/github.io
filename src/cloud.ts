/* Accounts and sync, through Supabase. Optional: without the two public settings (SUPABASE_URL and
   SUPABASE_ANON_KEY at build time) the app works exactly as before, with everything on the phone.

   Sign-in is by a code sent by email, because on iPhone a Home Screen app can't receive a magic link:
   the link opens in Safari, which keeps separate storage.

   Sync: each stored part (profile, likes, saves, learning progress…) carries the time it last changed.
   Pulling takes any part that's newer in the account; pushing sends any part that's newer here.
   So two phones merge cleanly, and a new phone gets everything back. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { S, load, save, onChange } from './state';
import type { Event } from './events';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
export const cloudOn = !!(__SUPABASE_URL__ && __SUPABASE_ANON_KEY__);

const SYNCED = ['profile', 'liked', 'saved', 'follows', 'entities', 'weights', 'seen', 'read', 'stats', 'feedback', 'srs', 'srs-shown', 'pod'];
type Doc = Record<string, { t: number; v: unknown }>;

let meta = load<Record<string, number>>('sync-meta', {});
let client: SupabaseClient | null = null;
let user: { id: string; email: string } | null = null;
let applying = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastSync = load<number>('sync-last', 0);

async function sb(): Promise<SupabaseClient | null> {
  if (!cloudOn) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kf-auth' } });
  }
  return client;
}

const has = (k: string) => { try { return localStorage.getItem('kf2-' + k) !== null; } catch { return false; } };
const saveMeta = () => save('sync-meta', meta);

onChange(k => {
  if (applying || !SYNCED.includes(k)) return;
  meta[k] = Date.now(); saveMeta();
  if (user) { clearTimeout(timer); timer = setTimeout(() => { push().catch(() => {}); }, 2500); }
});

export const signedIn = () => user;
export const lastSynced = () => lastSync;

/* On opening: restore the session, then fetch anything newer. Returns true if the account had newer data. */
export async function start(): Promise<boolean> {
  const c = await sb(); if (!c) return false;
  try {
    const { data } = await c.auth.getSession();
    const u = data.session?.user;
    if (!u) return false;
    user = { id: u.id, email: u.email || '' };
    return await withTimeout(pull(), 5000, false);
  } catch { return false; }
}

export async function sendCode(email: string): Promise<string | null> {
  const c = await sb(); if (!c) return 'Accounts aren’t switched on yet.';
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin } });
  if (!error) return null;
  if (/rate|security purposes|too many/i.test(error.message)) return 'Too many codes asked for in a short time. Wait a minute and try again.';
  return error.message;
}

export async function verifyCode(email: string, code: string): Promise<string | null> {
  const c = await sb(); if (!c) return 'Accounts aren’t switched on yet.';
  const { data, error } = await c.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error || !data.user) return /expired|invalid/i.test(error?.message || '') ? 'That code didn’t work. It may have expired.' : error?.message || 'That code didn’t work.';
  user = { id: data.user.id, email: data.user.email || email };
  return null;
}

/* Take anything newer from the account. True if something changed here. */
export async function pull(): Promise<boolean> {
  const c = await sb(); if (!c || !user) return false;
  const { data, error } = await c.from('user_state').select('data').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  const remote = (data?.data || {}) as Doc;
  let changed = false;
  applying = true;
  try {
    for (const k of SYNCED) {
      const r = remote[k];
      if (r && r.t > (meta[k] || 0)) { save(k, r.v); meta[k] = r.t; changed = true; }
    }
  } finally { applying = false; }
  saveMeta();
  if (SYNCED.some(k => has(k) && (meta[k] || 1) > (remote[k]?.t || 0))) await push(remote);
  else markSynced();
  return changed;
}

/* Send anything newer here, merged over what the account already has */
export async function push(known?: Doc): Promise<void> {
  const c = await sb(); if (!c || !user) return;
  let remote = known;
  if (!remote) { const { data } = await c.from('user_state').select('data').eq('user_id', user.id).maybeSingle(); remote = (data?.data || {}) as Doc; }
  const doc: Doc = { ...remote };
  for (const k of SYNCED) {
    if (!has(k)) continue;
    const t = meta[k] || 1;   // data from before signing in counts as old, so the account wins a tie
    if (!doc[k] || t > doc[k].t) doc[k] = { t, v: load(k, null) };
  }
  const { error } = await c.from('user_state').upsert({ user_id: user.id, data: doc, updated_at: new Date().toISOString() });
  if (error) throw error;
  await mirrorProfile(c).catch(() => {});
  await flushEvents(c).catch(() => {});
  markSynced();
}
function markSynced() { lastSync = Date.now(); save('sync-last', lastSync); }

/* The main answers in plain columns too, for the admin page */
async function mirrorProfile(c: SupabaseClient) {
  const p = S.profile; if (!p || !user) return;
  await c.from('profiles').upsert({
    id: user.id, name: p.name, city: p.city?.name ?? null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    occupation_uri: p.job?.uri ?? null, job_title_raw: p.job?.raw ?? null, edition_times: p.editions, quiet_hours: p.quiet,
    daily_goal_min: p.goalMin ?? null, daily_limit_min: p.limitMin ?? null, updated_at: new Date().toISOString(),
  });
}

/* Usage events go to Knowfeed's own events table, a batch at a time */
async function flushEvents(c: SupabaseClient) {
  if (!user) return;
  const sent = load<string>('events-sent', '');
  const list = load<Event[]>('events', []).filter(e => e.at > sent).slice(-200);
  if (!list.length) return;
  const { error } = await c.from('events').insert(list.map(e => ({ user_id: user!.id, name: e.name, props: e.props ?? null, at: e.at })));
  if (!error) save('events-sent', list[list.length - 1].at);
}

export async function sendFeedback(f: { item?: string; title?: string; text: string; at: string }): Promise<boolean> {
  const c = await sb(); if (!c || !user) return false;
  const { error } = await c.from('feedback').insert({ user_id: user.id, item_id: f.item ?? null, title: f.title ?? null, text: f.text.slice(0, 2000), at: f.at });
  return !error;
}

export async function signOut() {
  const c = await sb(); if (!c) return;
  await push().catch(() => {});
  await c.auth.signOut().catch(() => {});
  user = null;
}

/* Deletes the account and everything in it (the phone's copy is cleared separately) */
export async function deleteAccount(): Promise<boolean> {
  const c = await sb(); if (!c || !user) return true;
  const { error } = await c.rpc('delete_me');
  if (error) return false;
  await c.auth.signOut().catch(() => {});
  user = null;
  return true;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>(r => setTimeout(() => r(fallback), ms))]);
}
