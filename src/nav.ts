/* The tab bar: Edition, Search, Chat, Saved and Profile. Learning, language and sport cards live in the edition itself;
   the Learn and Languages pages open from those cards and the done screen. Chat opens the settings chat. */
import { close as closeStory, isOpen } from './story';
import { stopAudio } from './audio';

export type Tab = 'edition' | 'learn' | 'langs' | 'saved' | 'search' | 'profile';
let tab: Tab = 'edition';
const renderers: Partial<Record<Tab, (el: HTMLElement) => void>> = {};
export const onTab = (t: Tab, fn: (el: HTMLElement) => void) => { renderers[t] = fn; };
export const currentTab = () => tab;

export function go(t: Tab) {
  if (isOpen()) closeStory();
  const page = document.getElementById('page')!;
  const feed = document.getElementById('feed')!;
  if (t !== 'edition') stopAudio();
  tab = t;
  document.body.dataset.tab = t;
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
