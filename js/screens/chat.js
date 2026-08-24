import { Store } from '../storage.js';
import { loadPhasesMeta, loadPhase } from '../phrases.js';
import { chatReply, MissingKeyError } from '../ai.js';
import { speak } from '../tts.js';
import { createRecognizer, isSupported as sttSupported } from '../stt.js';
import { navigate, escapeHtml, toast } from '../render.js';

export async function render(root, params) {
  const scenarioId = params.id;
  const data = await fetch('data/scenarios.json').then((r) => r.json());
  const scenario = data.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) { root.innerHTML = `<div class="empty-state">Scenario not found.</div>`; return; }

  let history = Store.getChat(scenarioId);
  let sending = false;

  drawChat();

  async function drawChat() {
    root.innerHTML = `
      <div class="top-bar">
        <button class="back-btn" id="back">←</button>
        <h1 style="font-size:1.05rem;">${scenario.icon} ${escapeHtml(scenario.title)}</h1>
        <button class="back-btn" id="reset-chat" title="Restart conversation">↺</button>
      </div>
      <p class="hint" style="margin-bottom:14px;">${escapeHtml(scenario.description)}</p>
      <div class="chat-log" id="chat-log">
        ${history.length ? history.map(bubbleHtml).join('') : `
          <div class="empty-state">
            <div class="big-emoji">💬</div>
            <p>Say hello to get started — replies stay within the Romanian you've already learned.</p>
          </div>`}
      </div>
      <div class="chat-input-row">
        ${sttSupported() ? `<button class="btn btn-icon mic-btn" id="mic-btn">🎤</button>` : ''}
        <textarea id="chat-input" placeholder="Type in Romanian or English…"></textarea>
        <button class="btn btn-icon" id="send-btn" style="background:var(--purple-deep);color:#fff;">➤</button>
      </div>
    `;
    document.getElementById('back').onclick = () => navigate('#/speak');
    document.getElementById('reset-chat').onclick = () => {
      Store.clearChat(scenarioId);
      history = [];
      drawChat();
    };
    document.querySelectorAll('[data-play]').forEach((btn) => {
      btn.onclick = () => speak(btn.dataset.play).catch(() => toast('No audio available — add a Google TTS key in Settings.'));
    });

    const input = document.getElementById('chat-input');
    document.getElementById('send-btn').onclick = () => handleSend(input.value);
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input.value); }
    };

    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
      micBtn.onclick = () => {
        if (micBtn.classList.contains('recording')) return;
        micBtn.classList.add('recording');
        const recognizer = createRecognizer({
          onResult: (transcript, isFinal) => { if (isFinal) input.value = transcript; },
          onEnd: () => micBtn.classList.remove('recording'),
          onError: () => { micBtn.classList.remove('recording'); toast('Could not access microphone'); },
          lang: 'ro-RO'
        });
        recognizer.start();
      };
    }

    const log = document.getElementById('chat-log');
    log.scrollTop = log.scrollHeight;
  }

  async function handleSend(text) {
    const trimmed = (text || '').trim();
    if (!trimmed || sending) return;
    sending = true;

    const userMsg = { role: 'user', ro: trimmed, en: '', ts: Date.now() };
    history.push(userMsg);
    Store.appendChat(scenarioId, userMsg);
    drawChat();
    appendTypingBubble();

    try {
      const vocab = await buildVocabList();
      const reply = await chatReply(scenario, vocab, history);
      const aiMsg = { role: 'assistant', ro: reply.ro, en: reply.en, ts: Date.now() };
      history.push(aiMsg);
      Store.appendChat(scenarioId, aiMsg);
      drawChat();
    } catch (err) {
      removeTypingBubble();
      if (err instanceof MissingKeyError) {
        toast('Add an Anthropic API key in Settings to chat with the AI partner.');
      } else {
        toast('Could not reach the AI conversation partner. Check your connection or API key.');
      }
    } finally {
      sending = false;
    }
  }

  function appendTypingBubble() {
    const log = document.getElementById('chat-log');
    const el = document.createElement('div');
    el.className = 'bubble bubble-ai';
    el.id = 'typing-bubble';
    el.textContent = '…';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }
  function removeTypingBubble() {
    const el = document.getElementById('typing-bubble');
    if (el) el.remove();
  }

  async function buildVocabList() {
    const meta = await loadPhasesMeta();
    const built = meta.filter((m) => m.status === 'complete');
    const phases = await Promise.all(built.map((m) => loadPhase(m.id)));
    const progress = Store.getAllProgress();
    const vocab = [];
    phases.forEach((p) => p.items.forEach((i) => { if (progress[i.id]) vocab.push(i.ro); }));
    return vocab;
  }
}

function bubbleHtml(msg) {
  const cls = msg.role === 'user' ? 'bubble-user' : 'bubble-ai';
  const playBtn = msg.role === 'assistant' ? `<button class="mini-audio" data-play="${escapeHtml(msg.ro)}">🔊 play</button>` : '';
  return `
    <div class="bubble ${cls}">
      <div>${escapeHtml(msg.ro)}</div>
      ${msg.en ? `<div class="gloss">${escapeHtml(msg.en)}</div>` : ''}
      ${playBtn}
    </div>`;
}
