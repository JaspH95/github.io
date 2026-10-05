/* Pronunciation for language phrases ("Hear it" and "Slowly"), spoken in the phrase's own language with the
   device's voice. Knowfeed doesn't read stories aloud. */
import { LANG_CODE } from './languages';
import { toast } from './ui';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

/* iPhones have much more natural "Enhanced" and "Premium" voices, free in Settings → Accessibility → Spoken Content */
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;
function quality(v: SpeechSynthesisVoice): number {
  if (NOVELTY.test(v.name)) return -10;
  return (/premium/i.test(v.name) ? 50 : 0) + (/enhanced|neural|natural|siri/i.test(v.name) ? 30 : 0) + (/google/i.test(v.name) ? 12 : 0) + (v.localService ? 2 : 0);
}
function voicesFor(code: string): SpeechSynthesisVoice[] {
  const base = code.slice(0, 2);
  return (synth?.getVoices() || []).filter(v => v.lang.replace('_', '-').slice(0, 2) === base && quality(v) >= 0)
    .sort((a, b) => (quality(b) + (b.lang.replace('_', '-') === code ? 5 : 0)) - (quality(a) + (a.lang.replace('_', '-') === code ? 5 : 0)));
}

export function speakIn(text: string, lang: string, rate = 0.85) {
  if (!synth) { toast("Sound isn't supported on this device"); return; }
  const code = LANG_CODE[lang] || 'en-GB';
  const v = voicesFor(code)[0];
  if (!v) toast(`No ${lang} voice on this device. Add one in Settings, Accessibility, Spoken Content`);
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = code; if (v) u.voice = v; u.rate = rate; synth.speak(u);
}

/* Stop a phrase mid-way, e.g. when leaving the page it was on */
export function stopAudio() { synth?.cancel(); }
