/* Edition notifications (web push). Turning them on stores this phone's push address in Supabase with the
   edition times, quiet hours and time zone; GitHub Actions (pipeline/push.ts) sends "your edition is ready"
   when the time comes. Needs an account, and on iPhone, Knowfeed added to the Home Screen (iOS 16.4 or later). */
import { S, load, save, onChange } from './state';
import { openSheet, closeSheet, toast, esc, ICON } from './ui';
import * as cloud from './cloud';
import { log } from './events';
import { openChat } from './chat';

declare const __VAPID_PUBLIC_KEY__: string;
const KEY = __VAPID_PUBLIC_KEY__;

export type PushState = 'on' | 'off' | 'blocked' | 'unsupported' | 'home-screen' | 'account' | 'not-ready';

const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const r = await navigator.serviceWorker.getRegistration();
  if (r) return r;
  try { return await navigator.serviceWorker.register('/sw.js'); } catch { return null; }
}
async function current(): Promise<PushSubscription | null> {
  const r = await registration();
  return r ? r.pushManager.getSubscription().catch(() => null) : null;
}

export async function pushState(): Promise<PushState> {
  if (!KEY || !cloud.cloudOn) return 'not-ready';
  if (ios() && !standalone()) return 'home-screen';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (!cloud.signedIn()) return 'account';
  return (await current()) && load('push-on', false) ? 'on' : 'off';
}

const b64 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
const prefs = () => ({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London', editions: S.profile?.editions || {}, quiet: S.profile?.quiet || {} });

async function store(sub: PushSubscription) {
  const j = sub.toJSON();
  return cloud.savePush({ endpoint: sub.endpoint, p256dh: j.keys?.p256dh || '', auth: j.keys?.auth || '', ...prefs() });
}

/* Must start from a tap: browsers only ask for permission straight after one */
export async function turnOn(): Promise<string | null> {
  const st = await pushState();
  if (st === 'home-screen') return 'Add Knowfeed to your Home Screen first, then open it from there.';
  if (st === 'account') return 'Sign in first, so Knowfeed knows where to send them.';
  if (st === 'unsupported') return "This browser can't show notifications from Knowfeed.";
  if (st === 'not-ready') return "Notifications aren't switched on for the beta yet.";
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'Notifications are blocked. You can allow them in your phone’s Settings, under Notifications.' : 'No problem. You can turn them on later.';
  const r = await registration(); if (!r) return "Couldn't set up notifications on this phone.";
  try {
    await navigator.serviceWorker.ready;
    const sub = (await r.pushManager.getSubscription()) || await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) });
    if (!(await store(sub))) return "Couldn't save that just now. Try again with signal.";
    save('push-on', true); log('push_on');
    return null;
  } catch { return "Couldn't set up notifications on this phone."; }
}

export async function turnOff() {
  const sub = await current();
  if (sub) { await cloud.deletePush(sub.endpoint).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  save('push-on', false); log('push_off');
}

/* Keep the sender's copy of your edition times and quiet hours up to date */
let t: ReturnType<typeof setTimeout> | undefined;
onChange(k => {
  if (k !== 'profile' || !load('push-on', false)) return;
  clearTimeout(t); t = setTimeout(async () => { const sub = await current(); if (sub && cloud.signedIn()) store(sub); }, 3000);
});

const STEPS_IOS = `<ol class="steps"><li>In Safari, tap <b>Share</b> ${ICON.share}</li><li>Choose <b>Add to Home Screen</b></li><li>Open Knowfeed from your Home Screen and come back here</li></ol><p class="note">iPhone needs iOS 16.4 or later for notifications.</p>`;

/* Profile → Notifications */
export async function notifySheet(after?: () => void) {
  const st = await pushState();
  const e = S.profile?.editions;
  const times = e ? (['morning', 'midday', 'evening'] as const).filter(s => e[s].on).map(s => e[s].time).join(', ') : '';
  const body: Record<PushState, string> = {
    on: `<p class="note">On. You'll get one when each edition is ready${times ? ` (${esc(times)})` : ''}, only if there's something new, never in quiet hours, and no more than 3 a day.</p><div class="choices"><button class="cta ghost small" data-off>Turn off</button><button class="cta small" data-chat>Change edition times</button></div>`,
    off: `<p class="note">A short note when your edition is ready${times ? ` (${esc(times)})` : ''}. Only if there's something new, never during quiet hours, and no more than 3 a day.</p><div class="choices"><button class="cta small" data-on>Turn on notifications</button></div>`,
    blocked: '<p class="note">Notifications are blocked for Knowfeed. To allow them, open your phone’s Settings, then Notifications, then Knowfeed.</p>',
    unsupported: "<p class=\"note\">This browser can't show notifications from Knowfeed. Try Safari on iPhone (from the Home Screen) or Chrome.</p>",
    'home-screen': `<p class="note">On iPhone, notifications work once Knowfeed is on your Home Screen:</p>${STEPS_IOS}`,
    account: '<p class="note">Notifications need an account, so Knowfeed knows where to send them.</p><div class="choices"><button class="cta small" data-signin>Sign in or create an account</button></div>',
    'not-ready': "<p class=\"note\">Notifications aren't switched on for the beta yet. They're coming soon.</p>",
  };
  const s = openSheet(`<div class="notif"><h3>Notifications</h3>${body[st]}<p class="note" role="status" data-msg></p></div>`, 'Notifications');
  const msg = s.querySelector<HTMLElement>('[data-msg]')!;
  s.querySelector('[data-on]')?.addEventListener('click', async () => {
    msg.textContent = 'Setting up…';
    const err = await turnOn();
    if (err) { msg.textContent = err; return; }
    closeSheet(); toast("Notifications on. You'll hear when your next edition is ready"); after?.();
  });
  s.querySelector('[data-off]')?.addEventListener('click', async () => { await turnOff(); closeSheet(); toast('Notifications off'); after?.(); });
  s.querySelector('[data-chat]')?.addEventListener('click', () => { closeSheet(); openChat('editions'); });
  s.querySelector('[data-signin]')?.addEventListener('click', () => { closeSheet(); openChat('account'); });
}

export const pushLabel: Record<PushState, string> = {
  on: 'On', off: 'Off', blocked: 'Blocked in Settings', unsupported: 'Not available in this browser', 'home-screen': 'Add to Home Screen first', account: 'Needs an account', 'not-ready': 'Coming soon',
};

/* Opened from a notification: count it, then tidy the address */
export function fromPush() {
  const u = new URL(location.href);
  if (u.searchParams.get('from') !== 'push') return;
  log('notification_open', { slot: u.searchParams.get('slot') });
  history.replaceState(null, '', '/');
}
