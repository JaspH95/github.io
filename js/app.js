import { route, startRouter, currentPath } from './router.js';
import { Store } from './storage.js';
import { applyTheme } from './theme.js';
import * as dashboard from './screens/dashboard.js';
import * as phaselist from './screens/phaselist.js';
import * as lesson from './screens/lesson.js';
import * as speaking from './screens/speaking.js';
import * as chat from './screens/chat.js';
import * as translator from './screens/translator.js';
import * as cheatsheet from './screens/cheatsheet.js';
import * as progress from './screens/progress.js';
import * as settings from './screens/settings.js';

applyTheme(Store.getSettings().theme);

const screenEl = document.getElementById('screen');

const NAV_ITEMS = [
  { icon: '🏠', label: 'Home', hash: '#/', match: '/' },
  { icon: '📚', label: 'Learn', hash: '#/phases', match: '/phases' },
  { icon: '🗣️', label: 'Speak', hash: '#/speak', match: '/speak' },
  { icon: '🔤', label: 'Translate', hash: '#/translator', match: '/translator' },
  { icon: '📈', label: 'Progress', hash: '#/progress', match: '/progress' }
];

function renderNav() {
  const path = currentPath();
  const nav = document.getElementById('bottom-nav');
  nav.innerHTML = NAV_ITEMS.map((item) => `
    <button class="nav-item ${path === item.match ? 'active' : ''}" data-hash="${item.hash}">
      <span class="icon">${item.icon}</span>
      <span>${item.label}</span>
    </button>
  `).join('');
  nav.querySelectorAll('[data-hash]').forEach((btn) => {
    btn.onclick = () => { window.location.hash = btn.dataset.hash; };
  });
}

async function withScreen(renderFn, params) {
  screenEl.scrollTop = 0;
  try {
    await renderFn(screenEl, params || {});
  } catch (err) {
    console.error(err);
    screenEl.innerHTML = `<div class="empty-state"><div class="big-emoji">⚠️</div><p>Something went wrong loading this screen.</p></div>`;
  }
  renderNav();
}

route('/', (params) => withScreen(dashboard.render, params));
route('/phases', (params) => withScreen(phaselist.render, params));
route('/phase/:id', (params) => withScreen(lesson.render, params));
route('/speak', (params) => withScreen(speaking.render, params));
route('/repeat/:id', (params) => withScreen(speaking.render, params));
route('/chat/:id', (params) => withScreen(chat.render, params));
route('/translator', (params) => withScreen(translator.render, params));
route('/cheatsheet', (params) => withScreen(cheatsheet.render, params));
route('/progress', (params) => withScreen(progress.render, params));
route('/settings', (params) => withScreen(settings.render, params));

startRouter();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
