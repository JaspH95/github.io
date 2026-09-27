/* Listen mode: reads the edition (or a story) aloud with the device voice, British where available,
   with a mini player (pause, next, stop). Phrases are spoken in their own language. */
import { LANG_CODE } from './languages';
import { toast } from './ui';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
let voice: SpeechSynthesisVoice | null = null;
let on = false;
let queue: { text: string; label: string }[] = [];
let onDone: (() => void) | null = null;
let onNext: (() => boolean) | null = null;
let token = 0;   // stale utterances (cancelled ones can still fire 'end') are ignored

function pickVoice() {
  const vs = synth?.getVoices() || [];
  voice = vs.find(v => /en-GB/i.test(v.lang) && /natural|premium|enhanced|daniel|serena|kate|arthur|martha/i.test(v.name))
    || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

const player = () => document.getElementById('player')!;
export const isPlaying = () => on;

export function speakIn(text: string, lang: string, rate = 0.85) {
  if (!synth) { toast("Audio isn't supported on this device"); return; }
  const code = LANG_CODE[lang] || 'en-GB'; const base = code.slice(0, 2);
  const vs = synth.getVoices();
  const v = vs.find(x => x.lang.replace('_', '-') === code) || vs.find(x => x.lang.slice(0, 2) === base);
  if (!v) toast(`No ${lang} voice on this device. Add one in Settings, Accessibility, Spoken Content`);
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = code; if (v) u.voice = v; u.rate = rate; synth.speak(u);
}

/* Play a list of passages. `next` lets Listen mode move on to the next card when the list runs out. */
export function playQueue(items: { text: string; label: string }[], opts: { next?: () => boolean; done?: () => void } = {}) {
  if (!synth) { toast("Audio isn't supported on this device"); return; }
  token++; synth.cancel();
  queue = items.filter(i => i.text?.trim()); on = true; onNext = opts.next || null; onDone = opts.done || null;
  const p = player(); p.classList.add('show'); p.querySelector('.pp')!.innerHTML = 'Pause';
  document.body.classList.add('playing');
  step();
}

function step() {
  if (!on) return;
  const it = queue.shift();
  if (!it) {
    if (onNext && onNext()) return;
    stopAudio(); onDone?.(); return;
  }
  player().querySelector('.now')!.textContent = it.label;
  const u = new SpeechSynthesisUtterance(it.text);
  if (voice) u.voice = voice; u.lang = voice?.lang || 'en-GB'; u.rate = 1.02;
  const mine = token;
  u.onend = () => { if (mine === token) step(); };
  u.onerror = () => {};
  synth!.speak(u);
}

export function stopAudio() {
  on = false; queue = []; onNext = null; token++;
  synth?.cancel();
  player()?.classList.remove('show');
  document.body.classList.remove('playing');
}

export function initAudio() {
  const p = player();
  p.querySelector('.pp')!.addEventListener('click', e => {
    if (!synth) return;
    const b = e.currentTarget as HTMLElement;
    if (synth.paused) { synth.resume(); b.textContent = 'Pause'; } else { synth.pause(); b.textContent = 'Play'; }
  });
  p.querySelector('.stop')!.addEventListener('click', stopAudio);
  p.querySelector('.skip')!.addEventListener('click', () => { token++; synth?.cancel(); queue = []; if (!(onNext && onNext())) stopAudio(); });
}
