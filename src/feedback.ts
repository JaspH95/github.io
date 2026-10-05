/* "Something wrong?" on every card and in settings. Notes are kept on the phone, emailed to Jasper
   (/api/feedback), and, when signed in, also saved in Knowfeed's feedback table. A note that can't be sent
   (no signal) waits in an outbox and goes next time the app opens online. */
import { S, persist, now, load, save, type Feedback } from './state';
import { openSheet, closeSheet, esc, toast } from './ui';
import { signedIn, sendFeedback, accessToken } from './cloud';
import { currentTab } from './nav';
import { log } from './events';

let outbox = load<Feedback[]>('fb-outbox', []);

async function email(f: Feedback): Promise<boolean> {
  try {
    const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: f.text, item: f.item, title: f.title, page: currentTab(), token: await accessToken() }) });
    // 503: email isn't set up yet, 400/403: it'll never send. Only retry on network or server trouble.
    return r.ok || (r.status >= 400 && r.status < 500) || r.status === 503;
  } catch { return false; }
}
async function deliver(f: Feedback): Promise<boolean> {
  const [mailed, stored] = await Promise.all([email(f), signedIn() ? sendFeedback(f) : Promise.resolve(true)]);
  return mailed && stored;
}
export async function flushOutbox() {
  if (!outbox.length || !navigator.onLine) return;
  const left: Feedback[] = [];
  for (const f of outbox) if (!(await deliver(f))) left.push(f);
  outbox = left; save('fb-outbox', outbox);
}

export function feedback(item?: string, title?: string) {
  const s = openSheet(`<form class="fb">
      <h3>${item ? 'Something wrong?' : 'Send feedback'}</h3>
      ${title ? `<p class="fb-about">About: ${esc(title)}</p>` : ''}
      <div class="fb-quick">${(item ? ['Wrong or misleading', 'Bad photo', 'Not interested', 'Broken link'] : ['I love this', 'Something is confusing', 'A bug', 'An idea']).map(q => `<button type="button" class="chip-btn" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <label class="sr" for="fbText">Your note</label>
      <textarea id="fbText" rows="4" maxlength="1000" placeholder="Tell us what happened"></textarea>
      <button class="cta full" type="submit">Send</button>
      <p class="fb-note">${signedIn() ? 'Sent to Jasper at Knowfeed with your email address, so he can reply.' : 'Sent to Jasper at Knowfeed without your name or email. Sign in if you’d like a reply.'}</p>
    </form>`, 'Feedback');
  const ta = s.querySelector<HTMLTextAreaElement>('#fbText')!;
  s.querySelectorAll<HTMLButtonElement>('.chip-btn').forEach(b => b.addEventListener('click', () => { b.classList.toggle('on'); }));
  s.querySelector('form')!.addEventListener('submit', e => {
    e.preventDefault();
    const quick = [...s.querySelectorAll<HTMLButtonElement>('.chip-btn.on')].map(b => b.dataset.q).join(', ');
    const text = [quick, ta.value.trim()].filter(Boolean).join(': ');
    if (!text) { ta.focus(); return; }
    const note = { at: now().toISOString(), ...(item ? { item } : {}), ...(title ? { title } : {}), text };
    S.feedback.unshift(note);
    S.feedback = S.feedback.slice(0, 200);
    persist.feedback();
    closeSheet();
    log('feedback', item ? { item } : {});
    deliver(note).then(ok => { if (ok) toast('Thanks. Sent to Knowfeed'); else { outbox.push(note); save('fb-outbox', outbox); toast('Thanks. Saved, and it’ll send when you’re back online'); } });
  });
}
