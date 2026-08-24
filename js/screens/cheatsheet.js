import { loadPhasesMeta, loadPhase } from '../phrases.js';
import { Store } from '../storage.js';
import { speak } from '../tts.js';
import { navigate, escapeHtml, toast } from '../render.js';

export async function render(root) {
  const meta = await loadPhasesMeta();
  const built = meta.filter((m) => m.status === 'complete');
  const phases = await Promise.all(built.map((m) => loadPhase(m.id)));
  const progress = Store.getAllProgress();
  const log = Store.getTranslatorLog();

  const learnedByPhase = built.map((m, idx) => ({
    meta: m,
    items: phases[idx].items.filter((i) => progress[i.id])
  })).filter((g) => g.items.length);

  root.innerHTML = `
    <div class="top-bar">
      <button class="back-btn" id="back">←</button>
      <h1 style="font-size:1.3rem;">Cheat Sheet</h1>
      <span style="width:40px;"></span>
    </div>
    <div class="search-box">
      <span class="icon">🔎</span>
      <input type="text" id="search-input" placeholder="Search everything you've learned…" />
    </div>
    <div id="results-area"></div>
  `;
  document.getElementById('back').onclick = () => navigate('#/');

  const searchInput = document.getElementById('search-input');
  searchInput.oninput = () => renderResults(searchInput.value.trim().toLowerCase());
  renderResults('');

  function renderResults(query) {
    const area = document.getElementById('results-area');
    if (!query) {
      if (!learnedByPhase.length && !log.length) {
        area.innerHTML = `<div class="empty-state"><div class="big-emoji">📇</div><p>Learn a few phrases and they'll show up here for quick reference.</p></div>`;
        return;
      }
      area.innerHTML = learnedByPhase.map(groupHtml).join('') + (log.length ? logGroupHtml(log.slice(0, 20)) : '');
    } else {
      const matches = [];
      learnedByPhase.forEach((g) => g.items.forEach((i) => {
        if (i.ro.toLowerCase().includes(query) || i.en.toLowerCase().includes(query)) matches.push(i);
      }));
      const logMatches = log.filter((l) => l.term.toLowerCase().includes(query) || l.translation.toLowerCase().includes(query));
      if (!matches.length && !logMatches.length) {
        area.innerHTML = `<div class="empty-state"><p>No matches for "${escapeHtml(query)}".</p></div>`;
      } else {
        area.innerHTML =
          (matches.length ? `<div class="section-title">Learned phrases</div>${matches.map(rowHtml).join('')}` : '') +
          (logMatches.length ? logGroupHtml(logMatches) : '');
      }
    }
    attachHandlers(area);
  }

  function attachHandlers(area) {
    area.querySelectorAll('[data-play]').forEach((btn) => {
      btn.onclick = () => speak(btn.dataset.play).catch(() => toast('No audio available — add a Google TTS key in Settings.'));
    });
  }
}

function groupHtml(g) {
  return `<div class="section-title">${g.meta.icon} ${escapeHtml(g.meta.title)}</div>${g.items.map(rowHtml).join('')}`;
}

function logGroupHtml(entries) {
  return `<div class="section-title">From your translator lookups</div>${entries.map((e) => rowHtml({
    ro: e.direction === 'en-ro' ? e.translation : e.term,
    en: e.direction === 'en-ro' ? e.term : e.translation
  })).join('')}`;
}

function rowHtml(item) {
  return `
    <div class="list-row">
      <button class="btn-icon" data-play="${escapeHtml(item.ro)}" style="width:36px;height:36px;font-size:0.9rem;flex-shrink:0;">🔊</button>
      <div style="flex:1;">
        <div class="ro">${escapeHtml(item.ro)}</div>
        <div class="en">${escapeHtml(item.en)}</div>
      </div>
    </div>`;
}
