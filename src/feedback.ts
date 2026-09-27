/* "Something wrong?" on every card and in settings. For now notes stay on this phone (see them, copy
   them or export them from settings); once accounts are switched on they'll be sent to Knowfeed. */
import { S, persist, now } from './state';
import { openSheet, closeSheet, esc, toast } from './ui';

export function feedback(item?: string, title?: string) {
  const s = openSheet(`<form class="fb">
      <h3>${item ? 'Something wrong?' : 'Send feedback'}</h3>
      ${title ? `<p class="fb-about">About: ${esc(title)}</p>` : ''}
      <div class="fb-quick">${(item ? ['Wrong or misleading', 'Bad photo', 'Not interested', 'Broken link'] : ['I love this', 'Something is confusing', 'A bug', 'An idea']).map(q => `<button type="button" class="chip-btn" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <label class="sr" for="fbText">Your note</label>
      <textarea id="fbText" rows="4" maxlength="1000" placeholder="Tell us what happened"></textarea>
      <button class="cta full" type="submit">Send</button>
      <p class="fb-note">Notes are kept on this phone for now. You can see them in Settings.</p>
    </form>`, 'Feedback');
  const ta = s.querySelector<HTMLTextAreaElement>('#fbText')!;
  s.querySelectorAll<HTMLButtonElement>('.chip-btn').forEach(b => b.addEventListener('click', () => { b.classList.toggle('on'); }));
  s.querySelector('form')!.addEventListener('submit', e => {
    e.preventDefault();
    const quick = [...s.querySelectorAll<HTMLButtonElement>('.chip-btn.on')].map(b => b.dataset.q).join(', ');
    const text = [quick, ta.value.trim()].filter(Boolean).join(': ');
    if (!text) { ta.focus(); return; }
    S.feedback.unshift({ at: now().toISOString(), ...(item ? { item } : {}), ...(title ? { title } : {}), text });
    S.feedback = S.feedback.slice(0, 200);
    persist.feedback();
    closeSheet();
    toast('Thanks. Noted');
  });
}
