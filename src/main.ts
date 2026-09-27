import './styles.css';
import { S } from './state';
import { loadData, data } from './data';
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
import { closeSheet } from './ui';
import { log } from './events';
import * as cloud from './cloud';

initNav(); initStory(); initAudio(); initChat(); initBackup(); initDev(); initPages(); initFeed(); initWellbeing();
document.getElementById('sheetBg')!.addEventListener('click', closeSheet);

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

onChatClosed(() => { if (S.profile) open(); });
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
  const [, changed] = await Promise.all([loadData(), cloud.start()]);
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
