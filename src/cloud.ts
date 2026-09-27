/* Accounts and sync, through Supabase. Optional: without the two public settings (SUPABASE_URL and
   SUPABASE_ANON_KEY at build time) the app works exactly as before, with everything on the phone.

   Sign-in is by email and password. (Supabase's free email sender can't be changed to include a code,
   and a magic link would open Safari, which keeps separate storage from the Home Screen app.
   With "Confirm email" switched off in Supabase, no email is sent at all.)
   Sign-in by emailed code is kept too, for when a custom email sender is set up (SUPABASE_EMAIL_CODES=1).

   Sync: each stored part (profile, likes, saves, learning progress…) carries the time it last changed.
   Pulling takes any part that's newer in the account; pushing sends any part that's newer here.
   So two phones merge cleanly, and a new phone gets everything back. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { S, load, save, onChange } from './state';
import type { Event } from './events';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
declare const __SUPABASE_EMAIL_CODES__: boolean;
export const emailCodes = __SUPABASE_EMAIL_CODES__;
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

const setUser = (u: { id: string; email?: string }, email: string) => { user = { id: u.id, email: u.email || email }; };

/* Returns null when signed in, or a message to show */
export async function signInPassword(email: string, password: string): Promise<string | null> {
  const c = await sb(); if (!c) return 'Accounts aren’t switched on yet.';
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (data.user && !error) { setUser(data.user, email); return null; }
  if (/confirm/i.test(error?.message || '')) return 'That account is waiting for an email confirmation, which Knowfeed doesn’t send yet. Ask the Knowfeed team to switch it on for you.';
  if (/invalid login|credentials/i.test(error?.message || '')) return 'That email and password don’t match an account. If you’ve forgotten your password, ask the Knowfeed team to reset it.';
  return error?.message || 'Couldn’t sign in just now.';
}

export async function signUp(email: string, password: string): Promise<{ ok: true } | { ok: false; exists?: boolean; msg: string }> {
  const c = await sb(); if (!c) return { ok: false, msg: 'Accounts aren’t switched on yet.' };
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return { ok: false, exists: true, msg: 'There’s already an account with that email.' };
    if (/password/i.test(error.message)) return { ok: false, msg: 'That password is too weak. Try a longer one.' };
    return { ok: false, msg: error.message };
  }
  if (data.session && data.user) { setUser(data.user, email); return { ok: true }; }
  // No session: either the email is taken (Supabase hides that) or email confirmation is switched on
  const again = await signInPassword(email, password);
  if (!again) return { ok: true };
  if (data.user && !data.user.identities?.length) return { ok: false, exists: true, msg: 'There’s already an account with that email.' };
  return { ok: false, msg: 'The account was made, but Supabase wants the email confirmed first. Switch off "Confirm email" in Supabase (see SETUP.md), then sign in.' };
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
