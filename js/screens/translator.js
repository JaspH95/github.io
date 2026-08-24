import { Store } from '../storage.js';
import { translate, MissingKeyError } from '../ai.js';
import { speak } from '../tts.js';
import { createRecognizer, isSupported as sttSupported } from '../stt.js';
import { escapeHtml, toast } from '../render.js';

export async function render(root) {
  const log = Store.getTranslatorLog();

  root.innerHTML = `
    <div class="top-bar"><h1>Translator</h1></div>
    <div class="card">
      <div class="field" style="margin-bottom:10px;">
        <textarea id="translate-input" placeholder="Type in Romanian or English…" rows="2"></textarea>
      </div>
      <div style="display:flex;gap:8px;">
        ${sttSupported() ? `<button class="btn btn-icon mic-btn" id="mic-btn">🎤</button>` : ''}
        <button class="btn btn-primary" style="flex:1;" id="translate-btn">Translate</button>
      </div>
      <div id="result-area"></div>
    </div>

    <div class="section-title">Recent lookups</div>
    <div id="log-area">
      ${log.length ? log.slice(0, 30).map(logRow).join('') : `<div class="empty-state"><div class="big-emoji">🔤</div><p>Your lookups will show up here.</p></div>`}
    </div>
  `;

  const input = document.getElementById('translate-input');
  document.getElementById('translate-btn').onclick = () => doTranslate(input.value);
  input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doTranslate(input.value); } };

  const micBtn = document.getElementById('mic-btn');
  if (micBtn) {
    micBtn.onclick = () => {
      if (micBtn.classList.contains('recording')) return;
      micBtn.classList.add('recording');
      const recognizer = createRecognizer({
        onResult: (t, isFinal) => { if (isFinal) input.value = t; },
        onEnd: () => micBtn.classList.remove('recording'),
        onError: () => { micBtn.classList.remove('recording'); toast('Could not access microphone'); },
        lang: 'ro-RO'
      });
      recognizer.start();
    };
  }

  root.querySelectorAll('[data-play]').forEach((btn) => {
    btn.onclick = () => speak(btn.dataset.play).catch(() => toast('No audio available — add a Google TTS key in Settings.'));
  });

  async function doTranslate(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const resultArea = document.getElementById('result-area');
    resultArea.innerHTML = `<div class="hint" style="margin-top:12px;">Translating…</div>`;
    try {
      const { direction, translation } = await translate(trimmed);
      const roText = direction === 'en-ro' ? translation : trimmed;
      resultArea.innerHTML = `
        <div class="card card-lime" style="margin-top:14px;">
          <button class="audio-btn" data-play="${escapeHtml(roText)}" id="result-audio">🔊</button>
          <div style="text-align:center;font-weight:700;font-size:1.1rem;">${escapeHtml(direction === 'en-ro' ? translation : trimmed)}</div>
          <div style="text-align:center;color:var(--ink-soft);margin-top:4px;">${escapeHtml(direction === 'en-ro' ? trimmed : translation)}</div>
        </div>
      `;
      document.getElementById('result-audio').onclick = () => speak(roText).catch(() => toast('No audio available — add a Google TTS key in Settings.'));
      const record = Store.logTranslatorLookup({ term: trimmed, translation, direction });
      document.getElementById('log-area').insertAdjacentHTML('afterbegin', logRow(record));
      root.querySelectorAll('[data-play]').forEach((btn) => {
        btn.onclick = () => speak(btn.dataset.play).catch(() => toast('No audio available — add a Google TTS key in Settings.'));
      });
    } catch (err) {
      if (err instanceof MissingKeyError) {
        resultArea.innerHTML = `<div class="hint" style="margin-top:12px;">Add an Anthropic API key in Settings to enable translation.</div>`;
      } else {
        resultArea.innerHTML = `<div class="hint" style="margin-top:12px;">Translation failed — check your connection or API key.</div>`;
      }
    }
  }
}

function logRow(entry) {
  const roText = entry.direction === 'en-ro' ? entry.translation : entry.term;
  const enText = entry.direction === 'en-ro' ? entry.term : entry.translation;
  return `
    <div class="list-row">
      <button class="btn-icon" data-play="${escapeHtml(roText)}" style="width:36px;height:36px;font-size:0.9rem;flex-shrink:0;">🔊</button>
      <div style="flex:1;">
        <div class="ro">${escapeHtml(roText)}</div>
        <div class="en">${escapeHtml(enText)}</div>
      </div>
    </div>`;
}
