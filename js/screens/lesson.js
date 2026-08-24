import { loadPhasesMeta, loadPhase } from '../phrases.js';
import { Store } from '../storage.js';
import { schedule, isDue, freshEntry, MASTERY_LABELS } from '../srs.js';
import { speak } from '../tts.js';
import { navigate, escapeHtml, toast } from '../render.js';

const NEW_ITEMS_PER_SESSION = 5;
const REVIEW_ITEMS_PER_SESSION = 15;

function normalize(str) {
  return str.toLowerCase()
    .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i').replace(/ș/g, 's').replace(/ț/g, 't')
    .replace(/[^a-z0-9 ]/g, '').trim();
}

export async function render(root, params) {
  const phaseId = params.id;
  const meta = await loadPhasesMeta();
  const phaseMeta = meta.find((m) => String(m.id) === String(phaseId));
  if (!phaseMeta) { root.innerHTML = `<div class="empty-state">Phase not found.</div>`; return; }

  if (phaseMeta.status !== 'complete') {
    root.innerHTML = `
      <div class="top-bar">
        <button class="back-btn" id="back">←</button>
        <h1>${phaseMeta.icon} ${escapeHtml(phaseMeta.title)}</h1>
        <span style="width:40px;"></span>
      </div>
      <div class="empty-state">
        <div class="big-emoji">🚧</div>
        <p><strong>${escapeHtml(phaseMeta.title)}</strong> content is still being built.</p>
        <p class="hint">${escapeHtml(phaseMeta.description)}</p>
      </div>`;
    document.getElementById('back').onclick = () => navigate('#/phases');
    return;
  }

  const phase = await loadPhase(phaseId);
  renderOverview(root, phaseMeta, phase);
}

function renderOverview(root, phaseMeta, phase) {
  const progress = Store.getAllProgress();
  const dueItems = phase.items.filter((i) => progress[i.id] && isDue(progress[i.id]));
  const newItems = phase.items.filter((i) => !progress[i.id]);
  const learnedCount = phase.items.length - newItems.length;

  root.innerHTML = `
    <div class="top-bar">
      <button class="back-btn" id="back">←</button>
      <h1 style="font-size:1.2rem;">${phaseMeta.icon} ${escapeHtml(phaseMeta.title)}</h1>
      <span style="width:40px;"></span>
    </div>
    <p class="hint" style="margin-bottom:14px;">${escapeHtml(phaseMeta.description)}</p>

    <div class="card card-purple">
      <div class="stat-grid">
        <div class="stat-tile"><div class="num">${learnedCount}/${phase.items.length}</div><div class="label">Learned</div></div>
        <div class="stat-tile"><div class="num">${dueItems.length}</div><div class="label">Due now</div></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" id="start-session">
        ${dueItems.length || newItems.length ? '▶ Start session' : '✓ Review anytime'}
      </button>
    </div>

    <div class="section-title">Browse phrases</div>
    ${(phase.sections || []).map((s) => sectionBlock(s, phase.items.filter((i) => i.section === s.id), progress)).join('')}
  `;

  document.getElementById('back').onclick = () => navigate('#/phases');
  const startBtn = document.getElementById('start-session');
  if (startBtn) startBtn.onclick = () => startSession(root, phaseMeta, phase, dueItems, newItems);

  root.querySelectorAll('[data-audio]').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); speak(btn.dataset.audio).catch(() => toast('No audio available — add a Google TTS key in Settings for full audio.')); };
  });
}

function sectionBlock(section, items, progress) {
  if (!items.length) return '';
  return `
    <div class="section-title">${escapeHtml(section.title)}</div>
    ${items.map((i) => `
      <div class="list-row">
        <button class="btn-icon" data-audio="${escapeHtml(i.audio_text || i.ro)}" style="width:36px;height:36px;font-size:0.9rem;flex-shrink:0;">🔊</button>
        <div style="flex:1;">
          <div class="ro">${escapeHtml(i.ro)}</div>
          <div class="en">${escapeHtml(i.en)}</div>
        </div>
        ${progress[i.id] ? `<span class="chip chip-done" style="flex-shrink:0;">${MASTERY_LABELS[progress[i.id].mastery]}</span>` : ''}
      </div>
    `).join('')}
  `;
}

function startSession(root, phaseMeta, phase, dueItems, newItems) {
  const shuffledDue = [...dueItems].sort(() => Math.random() - 0.5).slice(0, REVIEW_ITEMS_PER_SESSION);
  const queue = [
    ...shuffledDue.map((item) => ({ item, mode: 'review' })),
    ...newItems.slice(0, NEW_ITEMS_PER_SESSION).map((item) => ({ item, mode: 'new' }))
  ];
  if (!queue.length) { toast('Nothing to review right now — nice work!'); return; }
  runSessionStep(root, phaseMeta, phase, queue, 0, { correct: 0, total: queue.length });
}

function runSessionStep(root, phaseMeta, phase, queue, index, tally) {
  if (index >= queue.length) {
    Store.touchStreak();
    root.innerHTML = `
      <div class="top-bar"><span></span><h1 style="font-size:1.2rem;">Session complete</h1><span></span></div>
      <div class="card card-lime" style="text-align:center;">
        <div style="font-size:2.4rem;">🎉</div>
        <div style="font-weight:800;font-size:1.2rem;margin-top:6px;">Great work!</div>
        <div class="hint">You reviewed ${tally.total} phrase${tally.total === 1 ? '' : 's'} in ${escapeHtml(phaseMeta.title)}.</div>
      </div>
      <div class="nav-row">
        <button class="btn btn-outline" id="back-overview">Back to phase</button>
        <button class="btn btn-primary" id="go-speak">Practice speaking →</button>
      </div>
    `;
    document.getElementById('back-overview').onclick = () => renderOverview(root, phaseMeta, phase);
    document.getElementById('go-speak').onclick = () => navigate(`#/repeat/${phaseMeta.id}`);
    return;
  }

  const { item, mode } = queue[index];
  const progressPct = Math.round((index / queue.length) * 100);

  if (mode === 'new') {
    renderNewCard(root, phaseMeta, phase, queue, index, tally, item, progressPct);
  } else {
    renderReviewCard(root, phaseMeta, phase, queue, index, tally, item, progressPct);
  }
}

function cardShell(progressPct, badge, bodyHtml) {
  return `
    <div class="top-bar"><span></span><h1 style="font-size:1.1rem;">${badge}</h1><span></span></div>
    <div class="progress-bar" style="margin-bottom:18px;"><div class="progress-bar-fill" style="width:${progressPct}%"></div></div>
    ${bodyHtml}
  `;
}

function formalityTag(f) {
  if (!f || f === 'neutral') return '';
  return `<span class="formality-tag formality-${f}">${f}</span>`;
}

function renderNewCard(root, phaseMeta, phase, queue, index, tally, item, progressPct) {
  root.innerHTML = cardShell(progressPct, 'New phrase', `
    <div class="phrase-card">
      ${formalityTag(item.formality)}
      <button class="audio-btn" id="play-audio">🔊</button>
      <div class="ro">${escapeHtml(item.ro)}</div>
      <div class="phonetic">${escapeHtml(item.phonetic)}</div>
      <div class="en">${escapeHtml(item.en)}</div>
      ${item.example_ro ? `
      <div class="example">
        <div class="ex-ro">${escapeHtml(item.example_ro)}</div>
        <div>${escapeHtml(item.example_en)}</div>
      </div>` : ''}
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:18px;" id="got-it">Got it →</button>
  `);
  document.getElementById('play-audio').onclick = () => speak(item.audio_text || item.ro).catch(() => toast('No audio available — add a Google TTS key in Settings.'));
  document.getElementById('got-it').onclick = () => {
    Store.setProgress(item.id, schedule(freshEntry(), 'good'));
    runSessionStep(root, phaseMeta, phase, queue, index + 1, tally);
  };
  speak(item.audio_text || item.ro).catch(() => {});
}

function renderReviewCard(root, phaseMeta, phase, queue, index, tally, item, progressPct) {
  root.innerHTML = cardShell(progressPct, 'Review', `
    <div class="phrase-card">
      ${formalityTag(item.formality)}
      <div class="en" style="font-size:1.3rem;font-weight:700;margin-bottom:14px;">${escapeHtml(item.en)}</div>
      <div class="field" style="text-align:left;">
        <label>Try saying or typing it in Romanian</label>
        <input type="text" id="recall-input" placeholder="ex: ..." autocomplete="off" autocapitalize="off" />
        <div id="match-hint" class="hint"></div>
      </div>
      <button class="btn btn-outline btn-block" id="reveal-btn">Show answer</button>
      <div id="answer-area" style="display:none;margin-top:16px;">
        <button class="audio-btn" id="play-audio">🔊</button>
        <div class="ro">${escapeHtml(item.ro)}</div>
        <div class="phonetic">${escapeHtml(item.phonetic)}</div>
        ${item.example_ro ? `
        <div class="example">
          <div class="ex-ro">${escapeHtml(item.example_ro)}</div>
          <div>${escapeHtml(item.example_en)}</div>
        </div>` : ''}
      </div>
    </div>
    <div id="rate-row" style="display:none;">
      <div class="section-title">How did you do?</div>
      <div class="nav-row">
        <button class="btn btn-outline btn-sm" data-q="again">Again</button>
        <button class="btn btn-outline btn-sm" data-q="hard">Hard</button>
        <button class="btn btn-outline btn-sm" data-q="good">Good</button>
        <button class="btn btn-lime btn-sm" data-q="easy">Easy</button>
      </div>
    </div>
  `);

  const input = document.getElementById('recall-input');
  input.oninput = () => {
    const hint = document.getElementById('match-hint');
    if (!input.value.trim()) { hint.textContent = ''; return; }
    hint.textContent = normalize(input.value) === normalize(item.ro) ? '✓ Looks right!' : '';
  };

  document.getElementById('reveal-btn').onclick = () => {
    document.getElementById('answer-area').style.display = 'block';
    document.getElementById('rate-row').style.display = 'block';
    document.getElementById('reveal-btn').style.display = 'none';
    document.getElementById('play-audio').onclick = () => speak(item.audio_text || item.ro).catch(() => toast('No audio available — add a Google TTS key in Settings.'));
    speak(item.audio_text || item.ro).catch(() => {});
  };

  root.querySelectorAll('[data-q]').forEach((btn) => {
    btn.onclick = () => {
      const prev = Store.getProgress(item.id) || freshEntry();
      Store.setProgress(item.id, schedule(prev, btn.dataset.q));
      tally.correct += btn.dataset.q !== 'again' ? 1 : 0;
      runSessionStep(root, phaseMeta, phase, queue, index + 1, tally);
    };
  });
}
