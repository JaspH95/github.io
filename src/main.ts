import './styles.css';
import { S } from './state';
import { loadData } from './cards';
import { setData, build, onRefresh } from './feed';
import { startOnboarding } from './chat';
import { startLive, startTfl } from './live';
import './audio';

/* The feed is rebuilt fresh from the latest data every time the app opens */
async function refreshAll() {
  setData(await loadData());
  build();
  startLive();
  startTfl();
}
onRefresh(() => { refreshAll(); });

refreshAll().then(() => { if (!S.profile) startOnboarding(); });

/* Home-screen apps on iPhone resume rather than reload: treat a return after a while as a fresh open */
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  const onb = document.getElementById('onb')!;
  const art = document.getElementById('article')!;
  if (hiddenAt && Date.now() - hiddenAt > 20 * 60_000 && !onb.classList.contains('open') && !art.classList.contains('open')) {
    refreshAll(); document.getElementById('feed')!.scrollTo({ top: 0 });
  }
});

/* Offline support: cache the app and the latest feed (for the Tube) */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
