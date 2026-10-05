/* Privacy choices. Knowfeed only keeps what it needs to work on this phone (settings, progress, sign-in), which
   needs no consent. Usage stats (events like "edition finished", sent to Knowfeed's own database for signed-in
   testers) are optional: they stay off unless someone taps Allow, and can be turned off any time in Profile.
   Both choices are offered with equal weight, and closing the banner without choosing leaves stats off. */
import { load, save } from './state';

export interface Consent { stats: boolean; at: string }
const KEY = 'consent';

export const consent = () => load<Consent | null>(KEY, null);
export const statsAllowed = () => consent()?.stats === true;

let onWithdraw: () => void = () => {};
export const onStatsWithdrawn = (fn: () => void) => { onWithdraw = fn; };

export function setStats(on: boolean) {
  const was = statsAllowed();
  save(KEY, { stats: on, at: new Date().toISOString() });
  // Turning stats off also clears what's been counted so far, here and in the account
  if (was && !on) { save('events', []); onWithdraw(); }
}

export function initConsent() {
  if (consent()) return;
  const b = document.createElement('section');
  b.className = 'consent glass';
  b.setAttribute('role', 'dialog');
  b.setAttribute('aria-label', 'Your privacy choices');
  b.innerHTML = `<h2>Your privacy</h2>
    <p>Knowfeed keeps your settings and progress on this phone so the app works. No ads, no trackers, no cookies.</p>
    <p>Can we also count how you use Knowfeed, like editions finished, to improve the beta? It's off unless you allow it, and you can change it any time in Profile.</p>
    <p class="consent-links"><a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a> · <a href="/cookies" target="_blank" rel="noopener">Cookie Policy</a></p>
    <div class="consent-btns"><button type="button" data-c="no">No thanks</button><button type="button" data-c="yes">Allow usage stats</button></div>`;
  b.querySelectorAll<HTMLButtonElement>('[data-c]').forEach(btn => btn.addEventListener('click', () => {
    setStats(btn.dataset.c === 'yes');
    b.classList.add('going');
    setTimeout(() => b.remove(), 250);
  }));
  document.body.appendChild(b);
}
