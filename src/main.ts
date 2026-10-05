/* Fonts are bundled with the app (SIL Open Font License), so no request goes to Google Fonts */
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import './styles.css';
import { S } from './state';
import { loadData, data, refreshLive } from './data';
import { showEdition, showJustIn, refreshDone, stale, initFeed } from './feed';
import { initStory } from './story';
import { initAudio } from './audio';
import { initChat, startOnboarding, onChatClosed } from './chat';
import { initBackup } from './backup';
import { initDev, onDevRebuild } from './dev';
import { initPages } from './pages';
import { initNav, go, currentTab, refreshTab } from './nav';
import { initWellbeing } from './wellbeing';
import { startLive } from './live';
import { closeSheet, sheetOpen } from './ui';
import { closeLesson } from './lessons';
import { log } from './events';
import * as cloud from './cloud';
import { initSeries, loadSeries } from './series';
import { initConsent } from './consent';
import { loadPacks } from './languages';

/* Knowfeed is an app, not a web page: no pinch zoom (text size still follows the iPhone's setting). iPhone ignores
   "user-scalable=no" in some cases, so pinches are stopped here too; double-tap zoom is off in CSS (touch-action). */
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

/* Home Screen app on iPhone: keep the top bar clear of the status bar, and fill the whole screen */
(function safeTop() {
  const standalone = (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!standalone || !/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height; probe.remove();
  if (h < 20) document.documentElement.style.setProperty('--safe-t', `${screen.height >= 812 ? 50 : 20}px`);
  // iOS 26 gives Home Screen apps a page shorter than the screen (WebKit bug 301108): a black strip is left at the bottom.
  // Stretch the page into it, stop anything clipping it, and hold the page still so the extra height can't scroll.
  const fill = (reset = false) => {
    const portrait = matchMedia('(orientation: portrait)').matches;
    const full = portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width);
    const shim = full - window.innerHeight;
    const root = document.documentElement;
    if (shim > 20 && shim < 120) { root.style.setProperty('--shim', `${shim}px`); root.classList.add('ios-shim'); }
    // Once stretched, the page's own height can change what iOS reports, so only undo it when the phone turns
    else if (reset) { root.style.removeProperty('--shim'); root.classList.remove('ios-shim'); }
  };
  fill();
  window.addEventListener('resize', () => fill());
  window.addEventListener('orientationchange', () => setTimeout(() => fill(true), 300));
  window.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); }, { passive: true });
})();

initConsent();
initSeries(); initNav(); initStory(); initAudio(); initChat(); initBackup(); initDev(); initPages(); initFeed(); initWellbeing();
document.getElementById('sheetBg')!.addEventListener('click', closeSheet);

/* Keyboard: Escape closes sheets and lessons; on the edition, the arrow keys, Page Up/Down and J/K move between cards */
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
  if (e.key === 'Escape') {
    if (sheetOpen()) { closeSheet(); e.preventDefault(); return; }
    if (document.getElementById('lesson')?.classList.contains('open')) { closeLesson(); e.preventDefault(); return; }
  }
  if (typing || currentTab() !== 'edition' || document.body.classList.contains('story-open') || sheetOpen()) return;
  if (document.getElementById('onb')!.classList.contains('open')) return;
  const feed = document.getElementById('feed')!;
  const step = ({ ArrowDown: 1, PageDown: 1, j: 1, ArrowUp: -1, PageUp: -1, k: -1 } as Record<string, number>)[e.key];
  if (!step) return;
  e.preventDefault();
  feed.scrollBy({ top: step * feed.clientHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});

function ready() {
  document.body.classList.remove('loading');
  document.getElementById('offline')!.hidden = !!data.news;
}

function open() {
  go('edition');
  showEdition();
  startLive();
  log('edition_open');
}

onChatClosed(async () => {
  if (!S.profile) return;
  await refreshLive();   // outlets, breaking or typed-in topics may have changed
  // Back to wherever the chat was opened from; the edition is rebuilt with any changes either way
  const t = currentTab();
  if (t === 'edition') open(); else { showEdition(); startLive(); go(t); }
});
onDevRebuild(() => { showEdition(); if (currentTab() !== 'edition') go('edition'); });

/* After taking newer data from your account, start again so every part of the app reads it (at most once a minute) */
function reloadForSync(): boolean {
  let last = 0; try { last = +(sessionStorage.getItem('kf-sync-reload') || 0); } catch { /* blocked */ }
  if (Date.now() - last < 60_000) return false;
  try { sessionStorage.setItem('kf-sync-reload', String(Date.now())); } catch { /* blocked */ }
  location.reload();
  return true;
}

async function boot() {
  const [, changed] = await Promise.all([loadData(), cloud.start(), loadPacks(), loadSeries()]);
  if (changed && reloadForSync()) return;
  ready();
  if (!S.profile) { startOnboarding(); return; }
  open();
}
boot();

/* Home-screen apps on iPhone resume rather than reload: after a while away, fetch the latest data.
   A new edition appears once its time has come; otherwise big news shows as "Just in". */
let hiddenAt = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { hiddenAt = Date.now(); if (cloud.signedIn()) cloud.push().catch(() => {}); return; }
  if (!hiddenAt || !S.profile) return;
  if (document.getElementById('onb')!.classList.contains('open')) return;
  // Changes made on another phone
  if (cloud.signedIn() && Date.now() - hiddenAt > 60_000 && await cloud.pull().catch(() => false) && reloadForSync()) return;
  if (Date.now() - hiddenAt < 10 * 60_000) return;
  await loadData();
  ready();
  if (stale()) { showEdition(); log('edition_open'); if (currentTab() !== 'edition') refreshTab(); }
  else { showJustIn(); refreshDone(); }
  startLive();
});

/* Offline support: the app and the latest data are cached for when there's no signal */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
