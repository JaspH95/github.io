import { loadPhasesMeta, loadPhase } from '../phrases.js';
import { Store } from '../storage.js';
import { MASTERY_LABELS } from '../srs.js';
import { navigate, escapeHtml } from '../render.js';

export async function render(root) {
  const meta = await loadPhasesMeta();
  const built = meta.filter((m) => m.status === 'complete');
  const phases = await Promise.all(built.map((m) => loadPhase(m.id)));
  const progress = Store.getAllProgress();
  const streak = Store.getStreak();
  const chats = Store.getState().chats;
  const scenariosPracticed = Object.keys(chats).filter((k) => chats[k].length > 0).length;

  const totalLearned = Object.keys(progress).length;
  const masteryCounts = [0, 0, 0, 0, 0];
  Object.values(progress).forEach((p) => { masteryCounts[p.mastery] = (masteryCounts[p.mastery] || 0) + 1; });

  root.innerHTML = `
    <div class="top-bar">
      <h1>Progress</h1>
      <button class="back-btn" id="settings-btn">⚙️</button>
    </div>

    <div class="card card-purple">
      <div class="stat-grid">
        <div class="stat-tile"><div class="num">${totalLearned}</div><div class="label">Phrases learned</div></div>
        <div class="stat-tile"><div class="num">${scenariosPracticed}</div><div class="label">Scenarios practiced</div></div>
        <div class="stat-tile"><div class="num">${streak.current} 🔥</div><div class="label">Current streak</div></div>
        <div class="stat-tile"><div class="num">${streak.longest}</div><div class="label">Longest streak</div></div>
      </div>
    </div>
    <p class="hint" style="margin:10px 2px 0;">Missing a day just pauses your streak — no penalties, pick up whenever you're ready.</p>

    <div class="section-title">Mastery breakdown</div>
    <div class="card">
      ${MASTERY_LABELS.map((label, i) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:${i === MASTERY_LABELS.length - 1 ? '0' : '10px'};">
          <div style="width:80px;font-size:0.8rem;font-weight:700;color:var(--ink-soft);">${label}</div>
          <div class="progress-bar" style="flex:1;"><div class="progress-bar-fill" style="width:${totalLearned ? (masteryCounts[i] / totalLearned) * 100 : 0}%"></div></div>
          <div style="width:28px;text-align:right;font-weight:700;">${masteryCounts[i]}</div>
        </div>
      `).join('')}
    </div>

    <div class="section-title">By phase</div>
    <div class="phase-grid">
      ${built.map((m, idx) => {
        const total = phases[idx].items.length;
        const learned = phases[idx].items.filter((i) => progress[i.id]).length;
        const pct = total ? Math.round((learned / total) * 100) : 0;
        return `
          <button class="phase-card" data-phase-nav="${m.id}">
            <div class="emoji ${m.color}">${m.icon}</div>
            <div style="flex:1;">
              <div class="title">${escapeHtml(m.title)}</div>
              <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
            </div>
            <span class="chip chip-progress">${learned}/${total}</span>
          </button>`;
      }).join('')}
    </div>
  `;

  document.getElementById('settings-btn').onclick = () => navigate('#/settings');
  root.querySelectorAll('[data-phase-nav]').forEach((el) => { el.onclick = () => navigate(`#/phase/${el.dataset.phaseNav}`); });
}
