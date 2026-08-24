import { Store } from '../storage.js';
import { navigate, toast } from '../render.js';
import { applyTheme } from '../theme.js';

export async function render(root) {
  const settings = Store.getSettings();

  root.innerHTML = `
    <div class="top-bar">
      <button class="back-btn" id="back">←</button>
      <h1 style="font-size:1.3rem;">Settings</h1>
      <span style="width:40px;"></span>
    </div>

    <div class="section-title">Voice (text-to-speech)</div>
    <div class="card">
      <div class="field">
        <label>Google Cloud TTS API key <span style="font-weight:400;color:var(--muted);">(optional)</span></label>
        <input type="password" id="tts-key" value="${escapeAttr(settings.googleTtsKey)}" placeholder="Leave blank to use your browser's built-in voice" />
        <div class="hint">Free tier covers 4M characters/month. Without a key, the app falls back to your device's built-in Romanian voice if it has one — quality varies by device. Get a key from console.cloud.google.com → APIs & Services → enable "Cloud Text-to-Speech API" → Credentials.</div>
      </div>
    </div>

    <div class="section-title">AI conversation partner & translator</div>
    <div class="card">
      <div class="field">
        <label>Anthropic (Claude) API key</label>
        <input type="password" id="anthropic-key" value="${escapeAttr(settings.anthropicKey)}" placeholder="sk-ant-…" />
        <div class="hint">Required for the AI conversation partner and the translator. Get a key at console.anthropic.com. This key stays only in your browser's local storage — it's never sent anywhere except directly to Anthropic's API.</div>
      </div>
      <div class="field" style="margin-bottom:0;">
        <label>Model</label>
        <select id="ai-model">
          <option value="claude-opus-5" ${settings.aiModel === 'claude-opus-5' ? 'selected' : ''}>Claude Opus 5 — best quality (recommended)</option>
          <option value="claude-sonnet-5" ${settings.aiModel === 'claude-sonnet-5' ? 'selected' : ''}>Claude Sonnet 5 — good balance, lower cost</option>
          <option value="claude-haiku-4-5" ${settings.aiModel === 'claude-haiku-4-5' ? 'selected' : ''}>Claude Haiku 4.5 — fastest, cheapest</option>
        </select>
        <div class="hint">This is a pay-as-you-go personal API key — every message costs a small amount. Opus 5 gives the most natural conversation; Haiku is a good pick if you're chatting a lot and want to keep costs minimal.</div>
      </div>
    </div>

    <div class="section-title">Appearance</div>
    <div class="card">
      <div class="field" style="margin-bottom:0;">
        <label>Theme</label>
        <select id="theme-select">
          <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>Match system</option>
          <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
          <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
        </select>
      </div>
    </div>

    <div class="section-title">Your data</div>
    <div class="card">
      <p class="hint" style="margin-bottom:12px;">Everything — progress, streak, translator history — lives only on this device, in this browser. Nothing is uploaded anywhere.</p>
      <button class="btn btn-outline btn-block" id="export-btn" style="margin-bottom:10px;">Export my data (.json)</button>
      <button class="btn btn-outline btn-block" id="reset-btn" style="color:var(--danger);border-color:var(--danger);">Reset all progress</button>
    </div>

    <p class="hint" style="text-align:center;margin-top:20px;">Vorbește — a personal Romanian learning app</p>
  `;

  document.getElementById('back').onclick = () => navigate('#/');

  document.getElementById('tts-key').onchange = (e) => { Store.setSetting('googleTtsKey', e.target.value.trim()); toast('Saved'); };
  document.getElementById('anthropic-key').onchange = (e) => { Store.setSetting('anthropicKey', e.target.value.trim()); toast('Saved'); };
  document.getElementById('ai-model').onchange = (e) => { Store.setSetting('aiModel', e.target.value); toast('Saved'); };
  document.getElementById('theme-select').onchange = (e) => {
    Store.setSetting('theme', e.target.value);
    applyTheme(e.target.value);
  };

  document.getElementById('export-btn').onclick = () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vorbeste-progress.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  document.getElementById('reset-btn').onclick = () => {
    if (confirm('This will permanently erase all learning progress, streak, and translator history on this device. Continue?')) {
      Store.resetAll();
      toast('All progress reset');
      navigate('#/');
    }
  };
}

function escapeAttr(v) {
  return String(v || '').replace(/"/g, '&quot;');
}
