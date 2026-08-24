import { loadPhasesMeta, loadPhase } from '../phrases.js';
import { Store } from '../storage.js';
import { speak } from '../tts.js';
import { createRecognizer, isSupported as sttSupported } from '../stt.js';
import { navigate, escapeHtml, toast } from '../render.js';

export async function render(root, params) {
  if (params.id) {
    return renderRepeatAfterMe(root, params.id);
  }
  return renderHub(root);
}

async function renderHub(root) {
  const [meta, scenarios] = await Promise.all([
    loadPhasesMeta(),
    fetch('data/scenarios.json').then((r) => r.json())
  ]);
  const built = meta.filter((m) => m.status === 'complete');

  root.innerHTML = `
    <div class="top-bar"><h1>Speak</h1></div>

    <div class="section-title">Repeat after me</div>
    <p class="hint" style="margin-bottom:10px;">Hear a phrase, then try saying it back.</p>
    <div class="phase-grid">
      ${built.map((m) => `
        <button class="phase-card" data-repeat="${m.id}">
          <div class="emoji ${m.color}">${m.icon}</div>
          <div><div class="title">${escapeHtml(m.title)}</div><div class="subtitle">${escapeHtml(m.subtitle)}</div></div>
        </button>`).join('')}
    </div>

    <div class="section-title">AI conversation partner</div>
    <p class="hint" style="margin-bottom:10px;">Role-play real scenarios, using only what you've learned so far.</p>
    <div class="phase-grid">
      ${scenarios.scenarios.map((s) => `
        <button class="phase-card" data-chat="${s.id}">
          <div class="emoji purple">${s.icon}</div>
          <div><div class="title">${escapeHtml(s.title)}</div><div class="subtitle">${escapeHtml(s.description)}</div></div>
        </button>`).join('')}
    </div>
  `;

  root.querySelectorAll('[data-repeat]').forEach((el) => { el.onclick = () => navigate(`#/repeat/${el.dataset.repeat}`); });
  root.querySelectorAll('[data-chat]').forEach((el) => { el.onclick = () => navigate(`#/chat/${el.dataset.chat}`); });
}

async function renderRepeatAfterMe(root, phaseId) {
  const meta = await loadPhasesMeta();
  const phaseMeta = meta.find((m) => String(m.id) === String(phaseId));
  if (!phaseMeta || phaseMeta.status !== 'complete') {
    root.innerHTML = `<div class="empty-state">This phase isn't ready yet.</div>`;
    return;
  }
  const phase = await loadPhase(phaseId);
  const progress = Store.getAllProgress();
  let items = phase.items.filter((i) => progress[i.id]);
  if (!items.length) items = phase.items;
  items = [...items].sort(() => Math.random() - 0.5).slice(0, 12);

  let index = 0;
  showItem();

  function showItem() {
    if (index >= items.length) {
      root.innerHTML = `
        <div class="top-bar"><span></span><h1 style="font-size:1.2rem;">Nice work!</h1><span></span></div>
        <div class="card card-lime" style="text-align:center;">
          <div style="font-size:2.2rem;">🗣️</div>
          <div style="font-weight:800;">You practiced ${items.length} phrases out loud.</div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:14px;" id="done-btn">Back to Speak</button>
      `;
      document.getElementById('done-btn').onclick = () => navigate('#/speak');
      return;
    }
    const item = items[index];
    root.innerHTML = `
      <div class="top-bar">
        <button class="back-btn" id="back">←</button>
        <h1 style="font-size:1.1rem;">${index + 1} / ${items.length}</h1>
        <span style="width:40px;"></span>
      </div>
      <div class="phrase-card">
        <button class="audio-btn" id="play-audio">🔊</button>
        <div class="ro">${escapeHtml(item.ro)}</div>
        <div class="phonetic">${escapeHtml(item.phonetic)}</div>
        <div class="en">${escapeHtml(item.en)}</div>
      </div>

      <div class="card" style="margin-top:16px;text-align:center;">
        ${sttSupported() ? `
          <button class="btn btn-icon mic-btn" id="mic-btn" style="width:64px;height:64px;font-size:1.6rem;">🎤</button>
          <div class="hint" id="mic-hint">Tap the mic and say the phrase</div>
          <div id="transcript-result" style="margin-top:10px;font-weight:600;"></div>
        ` : `<div class="hint">Speech recognition isn't supported in this browser — you can still listen and repeat out loud.</div>`}
      </div>

      <div class="nav-row">
        <button class="btn btn-outline" id="prev-btn" ${index === 0 ? 'disabled' : ''}>← Back</button>
        <button class="btn btn-primary" id="next-btn">Next →</button>
      </div>
    `;
    document.getElementById('back').onclick = () => navigate('#/speak');
    document.getElementById('play-audio').onclick = () => speak(item.audio_text || item.ro).catch(() => toast('No audio available — add a Google TTS key in Settings.'));
    document.getElementById('prev-btn').onclick = () => { index -= 1; showItem(); };
    document.getElementById('next-btn').onclick = () => { index += 1; showItem(); };
    speak(item.audio_text || item.ro).catch(() => {});

    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
      let recognizer = null;
      micBtn.onclick = () => {
        if (micBtn.classList.contains('recording')) return;
        micBtn.classList.add('recording');
        document.getElementById('mic-hint').textContent = 'Listening…';
        recognizer = createRecognizer({
          onResult: (transcript, isFinal) => {
            if (isFinal) {
              const resultEl = document.getElementById('transcript-result');
              const matched = compareRomanian(transcript, item.ro);
              resultEl.innerHTML = matched
                ? `✅ "${escapeHtml(transcript)}" — nice!`
                : `🔁 Heard: "${escapeHtml(transcript)}" — give it another try`;
            }
          },
          onError: () => {
            micBtn.classList.remove('recording');
            document.getElementById('mic-hint').textContent = 'Could not access microphone';
          },
          onEnd: () => {
            micBtn.classList.remove('recording');
            document.getElementById('mic-hint').textContent = 'Tap the mic and say the phrase';
          },
          lang: 'ro-RO'
        });
        recognizer.start();
      };
    }
  }
}

function compareRomanian(a, b) {
  const norm = (s) => s.toLowerCase()
    .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i').replace(/ș/g, 's').replace(/ț/g, 't')
    .replace(/[^a-z0-9 ]/g, '').trim();
  return norm(a) === norm(b);
}
