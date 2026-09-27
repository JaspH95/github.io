/* "Something wrong?" on every card and in settings. Notes are kept on the phone and, when signed in, sent to Knowfeed's feedback table. */
import { S, persist, now } from './state';
import { openSheet, closeSheet, esc, toast } from './ui';
import { signedIn, sendFeedback } from './cloud';

export function feedback(item?: string, title?: string) {
  const s = openSheet(`<form class="fb">
      <h3>${item ? 'Something wrong?' : 'Send feedback'}</h3>
      ${title ? `<p class="fb-about">About: ${esc(title)}</p>` : ''}
      <div class="fb-quick">${(item ? ['Wrong or misleading', 'Bad photo', 'Not interested', 'Broken link'] : ['I love this', 'Something is confusing', 'A bug', 'An idea']).map(q => `<button type="button" class="chip-btn" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <label class="sr" for="fbText">Your note</label>
      <textarea id="fbText" rows="4" maxlength="1000" placeholder="Tell us what happened"></textarea>
      <button class="cta full" type="submit">Send</button>
      <p class="fb-note">${signedIn() ? 'Sent to Knowfeed with your account, and kept in Settings.' : 'Kept on this phone. Sign in from Settings to send notes to Knowfeed.'}</p>
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
    if (signedIn()) sendFeedback(note).then(ok => toast(ok ? 'Thanks. Sent to Knowfeed' : 'Thanks. Saved, and it’ll send later')); else toast('Thanks. Noted');
  });
}
