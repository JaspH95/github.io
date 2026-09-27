/* The tab bar: Edition, Saved and the menu (Learn, Languages, settings), plus Search.
   Learning and language cards also turn up inside every edition; the menu is for going deeper. */
import { close as closeStory, isOpen } from './story';
import { stopAudio } from './audio';

export type Tab = 'edition' | 'learn' | 'langs' | 'saved' | 'search';
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
  document.querySelectorAll<HTMLButtonElement>('.tab, .search').forEach(b => { const on = b.dataset.tab === t || (!!b.dataset.menu && (t === 'learn' || t === 'langs')); b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  if (t === 'edition') { page.hidden = true; feed.hidden = false; return; }
  feed.hidden = true; page.hidden = false;
  page.innerHTML = '';
  page.scrollTop = 0;
  renderers[t]?.(page);
}

let menuFn: () => void = () => {};
export const onMenu = (fn: () => void) => { menuFn = fn; };
export function refreshTab() { if (tab !== 'edition') go(tab); }

export function initNav() {
  document.querySelectorAll<HTMLButtonElement>('.tab[data-tab], .search').forEach(b => b.addEventListener('click', () => {
    // Tapping Edition again goes back to the top
    if (b.dataset.tab === 'edition' && tab === 'edition') { document.getElementById('feed')!.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    go(b.dataset.tab as Tab);
  }));
  document.querySelector('.tab[data-menu]')?.addEventListener('click', () => menuFn());
}
