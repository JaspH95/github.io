/* Edition notifications (web push). Run by GitHub Actions every 15 minutes: npm run push
   For each phone that turned notifications on, send one when an edition's time has come, in that person's
   time zone, if there's new news since the last one. Never during quiet hours, never more than 3 a day,
   once per edition, and not at all if the edition time passed more than 2 hours ago (GitHub can run late).
   Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
   --dry prints what would be sent without sending anything. */
import { readFileSync } from 'node:fs';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

type Slot = 'morning' | 'midday' | 'evening';
const SLOTS: Slot[] = ['morning', 'midday', 'evening'];
const LABEL: Record<Slot, string> = { morning: 'morning', midday: 'midday', evening: 'evening' };
interface Row {
  endpoint: string; user_id: string; p256dh: string; auth: string; timezone: string;
  editions: Partial<Record<Slot, { on: boolean; time: string }>>;
  quiet: { on?: boolean; weekdays?: [string, string][] };
  sent: { date?: string; slots?: Slot[]; at?: string };
}

const dry = process.argv.includes('--dry');
const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

/* The date, minutes past midnight and weekday where the person is */
export function localNow(tz: string, at = new Date()) {
  let parts: Record<string, string>;
  try { parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(at).map(p => [p.type, p.value])); }
  catch { return localNow('Europe/London', at); }
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: +parts.hour * 60 + +parts.minute, weekend: parts.weekday === 'Sat' || parts.weekday === 'Sun' };
}

export function inQuiet(q: Row['quiet'], t: { min: number; weekend: boolean }) {
  if (!q?.on || t.weekend) return false;
  return (q.weekdays || []).some(([a, b]) => t.min >= mins(a) && t.min < mins(b));
}

/* Which edition (if any) to send for now: its time has passed in the last 2 hours and it hasn't been sent */
export function dueSlot(r: Row, at = new Date()): Slot | null {
  const t = localNow(r.timezone || 'Europe/London', at);
  const sent = r.sent?.date === t.date ? r.sent.slots || [] : [];
  if (sent.length >= 3 || inQuiet(r.quiet, t)) return null;
  for (const s of [...SLOTS].reverse()) {
    const e = r.editions?.[s];
    if (!e?.on || !/^\d\d:\d\d$/.test(e.time)) continue;
    const since = t.min - mins(e.time);
    if (since >= 0 && since <= 120) return sent.includes(s) ? null : s;
  }
  return null;
}

async function main() {
  const url = process.env.SUPABASE_URL?.trim(), key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const pub = process.env.VAPID_PUBLIC_KEY?.trim(), priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!url || !key || !pub || !priv) { console.log('Notifications: not set up yet (needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). Nothing sent.'); return; }
  webpush.setVapidDetails('mailto:jasperhayward@me.com', pub, priv);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from('push_subscriptions').select('*');
  if (error) throw new Error(`Couldn't read subscriptions: ${error.message}`);
  const rows = (data || []) as Row[];
  // The latest stories, from the hourly data
  let stories: { title: string; first: string; importance: number }[] = [];
  try { stories = JSON.parse(readFileSync('public/data/news.json', 'utf8')).stories || []; } catch { /* no data: nothing new */ }
  let sent = 0, skipped = 0, gone = 0;
  for (const r of rows) {
    const slot = dueSlot(r);
    if (!slot) { skipped++; continue; }
    // Only if there's news since the last notification (or the last 8 hours)
    const since = r.sent?.at ? Date.parse(r.sent.at) : Date.now() - 8 * 3600_000;
    const fresh = stories.filter(s => Date.parse(s.first) > since).sort((a, b) => b.importance - a.importance);
    if (!fresh.length) { skipped++; continue; }
    const payload = {
      title: `Your ${LABEL[slot]} edition is ready`,
      body: `Top story: ${fresh[0].title.slice(0, 110)}. Plus today's learning.`,
      url: `/?from=push&slot=${slot}`, tag: `edition-${slot}`,
    };
    const t = localNow(r.timezone || 'Europe/London');
    const sentToday = r.sent?.date === t.date ? r.sent.slots || [] : [];
    if (dry) { console.log(`Would send to ${r.user_id.slice(0, 8)}… (${r.timezone}): ${payload.title} · ${payload.body}`); sent++; continue; }
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, JSON.stringify(payload), { TTL: 2 * 3600, urgency: 'normal', topic: payload.tag });
      await db.from('push_subscriptions').update({ sent: { date: t.date, slots: [...sentToday, slot], at: new Date().toISOString() } }).eq('endpoint', r.endpoint);
      sent++;
    } catch (e: any) {
      // The phone turned notifications off or the app was removed: forget this subscription
      if (e?.statusCode === 404 || e?.statusCode === 410) { await db.from('push_subscriptions').delete().eq('endpoint', r.endpoint); gone++; }
      else console.log(`Push failed (${e?.statusCode || e?.message}) for ${r.user_id.slice(0, 8)}…`);
    }
  }
  console.log(`Notifications: ${sent} ${dry ? 'would be ' : ''}sent, ${skipped} not due, ${gone} removed (of ${rows.length} phones).`);
}

if (process.argv[1]?.endsWith('push.ts')) main().catch(e => { console.error(e); process.exit(1); });
