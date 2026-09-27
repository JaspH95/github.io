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

async function boot() {
  await loadData();
  ready();
  if (!S.profile) { startOnboarding(); return; }
  open();
}
boot();

/* Home-screen apps on iPhone resume rather than reload: after a while away, fetch the latest data.
   A new edition appears once its time has come; otherwise big news shows as "Just in". */
let hiddenAt = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (!hiddenAt || Date.now() - hiddenAt < 10 * 60_000 || !S.profile) return;
  if (document.getElementById('onb')!.classList.contains('open')) return;
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
