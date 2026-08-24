import { Store } from '../storage.js';
import { loadPhasesMeta, loadPhase } from '../phrases.js';
import { isDue } from '../srs.js';
import { navigate, escapeHtml } from '../render.js';
import { getDeferredInstallPrompt, isStandalone } from '../installPrompt.js';

export async function render(root) {
  const meta = await loadPhasesMeta();
  const builtPhases = meta.filter((m) => m.status === 'complete');
  const allPhases = await Promise.all(builtPhases.map((m) => loadPhase(m.id)));
  const progress = Store.getAllProgress();
  const streak = Store.getStreak();

  const allItems = allPhases.flatMap((p) => p.items);
  const learnedCount = allItems.filter((i) => progress[i.id]).length;
  const dueCount = allItems.filter((i) => progress[i.id] && isDue(progress[i.id])).length;
  const translatorLog = Store.getTranslatorLog();

  // Suggest next phase: first built phase with unlearned items, else first planned phase.
  let suggestion = null;
  for (const p of allPhases) {
    const unlearned = p.items.filter((i) => !progress[i.id]);
    if (unlearned.length) { suggestion = { phaseMeta: builtPhases.find((m) => m.id === p.phase), unlearnedCount: unlearned.length }; break; }
  }

  const showInstall = !isStandalone() && !!getDeferredInstallPrompt();

  root.innerHTML = `
    <div class="top-bar">
      <h1>Bună, Emily! 👋</h1>
      <button class="back-btn" id="settings-btn" aria-label="Settings">⚙️</button>
    </div>

    ${showInstall ? `
    <div class="install-banner">
      <span>📲 Install this as an app for full-screen, offline access.</span>
      <button class="btn btn-sm btn-lime" id="install-btn">Install</button>
    </div>` : ''}

    <div class="card card-purple">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:0.8rem;font-weight:700;opacity:0.75;">Streak</div>
          <div style="font-size:1.8rem;font-weight:800;">${streak.current} day${streak.current === 1 ? '' : 's'} <span class="streak-flame">🔥</span></div>
        </div>
        <div style="text-align:right;font-size:0.78rem;opacity:0.75;">Longest<br><strong style="font-size:1rem;">${streak.longest}</strong></div>
      </div>
      <div class="stat-grid">
        <div class="stat-tile">
          <div class="num">${learnedCount}</div>
          <div class="label">Phrases learned</div>
        </div>
        <div class="stat-tile">
          <div class="num">${dueCount}</div>
          <div class="label">Due for review</div>
        </div>
      </div>
    </div>

    ${suggestion ? `
    <div class="card card-lime" id="suggestion-card" style="cursor:pointer;">
      <div style="font-size:0.75rem;font-weight:800;opacity:0.7;text-transform:uppercase;letter-spacing:0.04em;">Suggested next</div>
      <div style="font-size:1.15rem;font-weight:800;margin-top:4px;">${suggestion.phaseMeta.icon} ${escapeHtml(suggestion.phaseMeta.title)}</div>
      <div style="font-size:0.85rem;opacity:0.75;margin-top:2px;">${suggestion.unlearnedCount} phrase${suggestion.unlearnedCount === 1 ? '' : 's'} left to learn</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" id="continue-btn">Continue learning</button>
    </div>` : ''}

    ${dueCount > 0 ? `
    <div class="card">
      <div style="font-weight:700;">🔁 ${dueCount} phrase${dueCount === 1 ? '' : 's'} ready to review</div>
      <div class="hint">Quick review keeps your weak phrases from fading.</div>
    </div>` : ''}

    ${translatorLog.length >= 3 ? renderSuggestionFromLog(translatorLog, allPhases) : ''}

    <div class="section-title">Jump to any phase</div>
    <div class="phase-grid">
      ${meta.slice(0, 4).map((m) => phaseCardHtml(m)).join('')}
    </div>
    <button class="btn btn-outline btn-block" style="margin-top:10px;" id="see-all-phases">See all phases</button>

    <div class="section-title">Quick actions</div>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-outline" style="flex:1;" id="go-translator">🔤 Translator</button>
      <button class="btn btn-outline" style="flex:1;" id="go-cheatsheet">📇 Cheat sheet</button>
    </div>
  `;

  document.getElementById('settings-btn').onclick = () => navigate('#/settings');
  document.getElementById('see-all-phases').onclick = () => navigate('#/phases');
  document.getElementById('go-translator').onclick = () => navigate('#/translator');
  document.getElementById('go-cheatsheet').onclick = () => navigate('#/cheatsheet');

  const suggestionCard = document.getElementById('suggestion-card');
  if (suggestionCard) suggestionCard.onclick = (e) => { if (e.target.id !== 'continue-btn') navigate(`#/phase/${suggestion.phaseMeta.id}`); };
  const continueBtn = document.getElementById('continue-btn');
  if (continueBtn) continueBtn.onclick = () => navigate(`#/phase/${suggestion.phaseMeta.id}`);

  root.querySelectorAll('[data-phase-nav]').forEach((elm) => {
    elm.onclick = () => navigate(`#/phase/${elm.dataset.phaseNav}`);
  });

  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.onclick = async () => {
      const promptEvent = getDeferredInstallPrompt();
      if (!promptEvent) return;
      promptEvent.prompt();
      await promptEvent.userChoice;
    };
  }
}

function phaseCardHtml(m) {
  const chip = m.status === 'complete' ? '' : `<span class="chip chip-planned">coming soon</span>`;
  return `
    <button class="phase-card" data-phase-nav="${m.id}">
      <div class="emoji ${m.color}">${m.icon}</div>
      <div>
        <div class="title">${escapeHtml(m.title)}</div>
        <div class="subtitle">${escapeHtml(m.subtitle)}</div>
      </div>
      ${chip}
    </button>`;
}

function renderSuggestionFromLog(log, allPhases) {
  const recentTerms = log.slice(0, 8).map((l) => l.term.toLowerCase());
  const foodWords = ['food', 'eat', 'drink', 'dinner', 'hungry', 'mâncare', 'mananca', 'delicious'];
  const hitsFood = recentTerms.some((t) => foodWords.some((f) => t.includes(f)));
  if (!hitsFood) return '';
  return `
    <div class="card">
      <div style="font-weight:700;">💡 Noticed a pattern</div>
      <div class="hint">You've looked up several food words lately — want to jump into The Dinner Table phase?</div>
    </div>`;
}
