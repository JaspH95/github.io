/* "Forgot password": the email link opens Knowfeed with a one-time recovery session (cloud.recovery).
   This screen asks for the new password, then carries on into the app. */
import * as cloud from './cloud';
import { esc, ICON } from './ui';

export function showReset(): Promise<void> {
  return new Promise(done => {
    const el = document.createElement('section');
    el.className = 'reset'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'resetH');
    const u = cloud.signedIn();
    el.innerHTML = `<div class="aurora"></div><div class="reset-in">
      <span class="wm big">Knowfeed<i></i></span>
      <h1 id="resetH">Choose a new password</h1>
      <p>${u ? `For <b>${esc(u.email)}</b>. ` : ''}At least 8 characters.</p>
      <form novalidate>
        <input type="email" name="username" autocomplete="username" value="${esc(u?.email || '')}" class="sr" tabindex="-1" aria-hidden="true">
        <label class="sr" for="np1">New password</label><input id="np1" type="password" autocomplete="new-password" placeholder="New password" minlength="8" required>
        <label class="sr" for="np2">Type it again</label><input id="np2" type="password" autocomplete="new-password" placeholder="Type it again" minlength="8" required>
        <p class="reset-msg" role="alert"></p>
        <button class="glow-btn" type="submit">Save new password</button>
      </form></div>`;
    document.body.appendChild(el);
    const msg = el.querySelector<HTMLElement>('.reset-msg')!;
    const [a, b] = [el.querySelector<HTMLInputElement>('#np1')!, el.querySelector<HTMLInputElement>('#np2')!];
    setTimeout(() => a.focus(), 50);
    if (!u) msg.textContent = 'This reset link has expired or was already used. Ask for a new one: Profile → your name → Forgot password.';
    el.querySelector('form')!.addEventListener('submit', async e => {
      e.preventDefault();
      if (a.value.length < 8) { msg.textContent = 'Use at least 8 characters.'; a.focus(); return; }
      if (a.value !== b.value) { msg.textContent = "Those two don't match. Try again."; b.focus(); return; }
      msg.textContent = 'Saving…';
      const err = await cloud.setNewPassword(a.value);
      if (err) { msg.textContent = err; return; }
      history.replaceState(null, '', location.pathname);
      el.querySelector('.reset-in')!.innerHTML = `<span class="wm big">Knowfeed<i></i></span><h1>Password changed</h1>
        <p>You're signed in. If you use Knowfeed from your Home Screen, open it there and sign in with your new password.</p>
        <button class="glow-btn" type="button">Continue ${ICON.chev}</button>`;
      el.querySelector('button')!.addEventListener('click', () => { el.remove(); done(); });
    });
  });
}
