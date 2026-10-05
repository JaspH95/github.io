/* The tab bar: Edition, Search, Chat, Saved and Profile. Learning, language and sport cards live in the edition itself;
   the Learn and Languages pages open from those cards and the done screen. Chat opens the settings chat. */
import { close as closeStory, isOpen } from './story';
import { stopAudio } from './audio';

export type Tab = 'edition' | 'learn' | 'langs' | 'saved' | 'search' | 'profile';
let tab: Tab = 'edition';
const renderers: Partial<Record<Tab, (el: HTMLElement) => void>> = {};
export const onTab = (t: Tab, fn: (el: HTMLElement) => void) => { renderers[t] = fn; };
export const currentTab = () => tab;

/* Each view gets its own title in the browser tab, the app switcher and screen readers */
const TITLES: Record<Tab, string> = { edition: 'Your edition', learn: 'Learn', langs: 'Languages', saved: 'Saved', search: 'Search', profile: 'Profile' };
export const viewTitle = () => `${TITLES[tab]} · Knowfeed`;
window.addEventListener('kf:story-closed', () => { document.title = viewTitle(); });

export function go(t: Tab) {
  if (isOpen()) closeStory();
  const page = document.getElementById('page')!;
  const feed = document.getElementById('feed')!;
  if (t !== 'edition') stopAudio();
  tab = t;
  document.body.dataset.tab = t;
  document.title = viewTitle();
  // Pages have their own heading; the edition's is in the top bar, for screen readers
  document.getElementById('viewH1')!.hidden = t !== 'edition';
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  if (t === 'edition') { page.hidden = true; feed.hidden = false; return; }
  feed.hidden = true; page.hidden = false;
  page.innerHTML = '';
  page.scrollTop = 0;
  renderers[t]?.(page);
}

export function toTop() { document.getElementById('feed')!.scrollTo({ top: 0, behavior: 'smooth' }); }
export function refreshTab() { if (tab !== 'edition') go(tab); }

export function initNav() {
  document.querySelectorAll<HTMLButtonElement>('.tab[data-tab]').forEach(b => b.addEventListener('click', () => {
    // Tapping Edition again goes back to the top
    if (b.dataset.tab === 'edition' && tab === 'edition') { toTop(); return; }
    go(b.dataset.tab as Tab);
  }));
  // Tapping the Knowfeed wordmark always goes back to the top of the edition
  document.getElementById('wordmark')!.addEventListener('click', () => { if (tab !== 'edition') go('edition'); toTop(); });
}
