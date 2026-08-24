import { loadPhasesMeta, loadPhase } from '../phrases.js';
import { Store } from '../storage.js';
import { navigate, escapeHtml } from '../render.js';

export async function render(root) {
  const meta = await loadPhasesMeta();
  const progress = Store.getAllProgress();

  const cards = await Promise.all(meta.map(async (m) => {
    if (m.status !== 'complete') return { m, learned: 0, total: 0 };
    const phase = await loadPhase(m.id);
    const total = phase.items.length;
    const learned = phase.items.filter((i) => progress[i.id]).length;
    return { m, learned, total };
  }));

  root.innerHTML = `
    <div class="top-bar">
      <h1>Learn</h1>
    </div>
    <p class="hint" style="margin-bottom:16px;">Every phase is unlocked — jump around freely, or follow the suggested order.</p>
    <div class="phase-grid">
      ${cards.map(({ m, learned, total }) => phaseRow(m, learned, total)).join('')}
    </div>
  `;

  root.querySelectorAll('[data-phase-nav]').forEach((el) => {
    el.onclick = () => navigate(`#/phase/${el.dataset.phaseNav}`);
  });
}

function phaseRow(m, learned, total) {
  const pct = total ? Math.round((learned / total) * 100) : 0;
  const chip = m.status === 'complete'
    ? (learned === 0 ? '' : (learned === total ? `<span class="chip chip-done">done</span>` : `<span class="chip chip-progress">${pct}%</span>`))
    : `<span class="chip chip-planned">coming soon</span>`;
  return `
    <button class="phase-card" data-phase-nav="${m.id}" style="align-items:flex-start;">
      <div class="emoji ${m.color}">${m.icon}</div>
      <div style="flex:1;">
        <div class="title">${escapeHtml(m.title)}</div>
        <div class="subtitle">${escapeHtml(m.description)}</div>
        ${m.status === 'complete' ? `
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        ` : ''}
      </div>
      ${chip}
    </button>`;
}
