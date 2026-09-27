/* Listen mode: reads the edition (or a story) aloud with the device voice, British where available,
   with a mini player (pause, next, stop). Phrases are spoken in their own language. */
import { LANG_CODE } from './languages';
import { toast } from './ui';
import { load, save } from './state';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
let voice: SpeechSynthesisVoice | null = null;
let on = false;
let queue: { text: string; label: string }[] = [];
let onDone: (() => void) | null = null;
let onNext: (() => boolean) | null = null;
let token = 0;   // stale utterances (cancelled ones can still fire 'end') are ignored

/* The best-sounding voice on the phone. iPhones have much more natural "Enhanced" and "Premium" voices,
   free to download in Settings → Accessibility → Spoken Content → Voices; these are picked first. */
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;
function quality(v: SpeechSynthesisVoice): number {
  const n = v.name;
  if (NOVELTY.test(n)) return -10;
  return (/premium/i.test(n) ? 50 : 0) + (/enhanced|neural|natural|siri/i.test(n) ? 30 : 0) + (/google/i.test(n) ? 12 : 0) + (v.localService ? 2 : 0);
}
export function voicesFor(code: string): SpeechSynthesisVoice[] {
  const base = code.slice(0, 2);
  return (synth?.getVoices() || []).filter(v => v.lang.replace('_', '-').slice(0, 2) === base && quality(v) >= 0)
    .sort((a, b) => (quality(b) + (b.lang.replace('_', '-') === code ? 5 : 0)) - (quality(a) + (a.lang.replace('_', '-') === code ? 5 : 0)));
}
function pickVoice() {
  const chosen = load<string>('voice', '');
  const all = synth?.getVoices() || [];
  voice = all.find(v => v.voiceURI === chosen) || voicesFor('en-GB')[0] || null;
}
export function setVoice(uri: string) { save('voice', uri); pickVoice(); }
export const currentVoice = () => voice;
export const goodVoice = () => !!voice && quality(voice) >= 30;
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

const player = () => document.getElementById('player')!;
export const isPlaying = () => on;

export function sample(v: SpeechSynthesisVoice) {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance("Here's your morning edition. Five stories, about six minutes."); u.voice = v; u.lang = v.lang; synth.speak(u);
}

export function speakIn(text: string, lang: string, rate = 0.85) {
  if (!synth) { toast("Audio isn't supported on this device"); return; }
  const code = LANG_CODE[lang] || 'en-GB';
  const v = voicesFor(code)[0];
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
  if (voice) u.voice = voice; u.lang = voice?.lang || 'en-GB'; u.rate = 1;
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
