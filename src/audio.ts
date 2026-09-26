import { LANG_CODES } from './content';
import { toast } from './util';
import { feed, currentEl, setCurrent, label, cardTitle } from './feed';
import type { Card } from './cards';

/* Listen mode: reads your feed (or an article) aloud with the device voice, British where available */
const synth = window.speechSynthesis;
let voice: SpeechSynthesisVoice | null = null, audioOn = false, audioQueue: { text: string; label: string }[] = [], feedMode = false;

function pickVoice() {
  const vs = synth?.getVoices() || [];
  voice = vs.find(v => /en-GB/i.test(v.lang) && /natural|premium|enhanced|daniel|serena|kate/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
const player = document.getElementById('player')!;

/* Phrases in their own language, at normal or slow speed */
export function speakIn(text: string, lang: string, rate = 0.85) {
  if (!synth) { toast("Audio isn't supported on this device"); return; }
  const code = LANG_CODES[lang] || 'en-GB'; const base = code.slice(0, 2);
  const vs = synth.getVoices(); const v = vs.find(x => x.lang.replace('_', '-') === code) || vs.find(x => x.lang.slice(0, 2) === base);
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = code; if (v) u.voice = v; u.rate = rate; synth.speak(u);
}

function speakText(text: string, onend: () => void) {
  const u = new SpeechSynthesisUtterance(text); if (voice) u.voice = voice; u.lang = voice?.lang || 'en-GB'; u.rate = 1.02;
  u.onend = onend; u.onerror = () => {}; synth.speak(u);
}

export function playQueue(items: { text: string; label: string }[], mode = false) {
  if (!synth) { toast("Audio isn't supported on this device"); return; }
  synth.cancel(); audioQueue = items.slice(); audioOn = true; feedMode = mode; player.classList.add('show'); player.querySelector('.pp')!.textContent = 'Pause';
  next();
  function next() {
    if (!audioOn) return;
    const it = audioQueue.shift();
    if (!it) { if (feedMode) return advanceFeed(); return stopAudio(); }
    player.querySelector('.now')!.textContent = it.label; speakText(it.text, next);
  }
}

function cardSpeech(c?: Card): string | null {
  if (!c || c.type === 'intro' || c.type === 'end') return null;
  switch (c.type) {
    case 'news': return `${label(c)}. ${c.story!.title}. ${c.story!.standfirst}`;
    case 'learn': return c.learn!.kind === 'onthisday' ? `On this day in ${c.learn!.year}. ${c.learn!.event}` : `${label(c)}. ${c.learn!.title}. ${c.learn!.extract.split('. ').slice(0, 2).join('. ')}`;
    case 'quiz': return `Quiz. ${c.quiz!.q} ${c.quiz!.prompt || ''} ${c.quiz!.opts.join(', or ')}? The answer: ${c.quiz!.opts[c.quiz!.answer]}.`;
    case 'hubspot': return `HubSpot. ${c.hub!.title}. ${c.hub!.summary}`;
    case 'phrase': return `${c.phrase!.lang} phrase of the day. ${c.phrase!.p.meaning}. ${c.phrase!.p.when}`;
    case 'review': return null;
    case 'signday': return 'Sign of the day. The B S L vowels. Touch the thumb for A, then the fingertips for E, I, O and U.';
    case 'discover': return null;
    default: return `${label(c)}. ${cardTitle(c)}.`;
  }
}

function advanceFeed(): void {
  const nx = currentEl?.nextElementSibling as HTMLElement | null;
  if (!nx || !(nx as any)._card) { stopAudio(); toast("That's your feed. You're all caught up"); return; }
  feed.scrollTo({ top: nx.offsetTop, behavior: 'smooth' }); setCurrent(nx);
  const t = cardSpeech((nx as any)._card); if (!t) return advanceFeed();
  setTimeout(() => playQueue([{ text: t, label: cardTitle((nx as any)._card) || label((nx as any)._card) }], true), 500);
}

function listenFeed() {
  let el = currentEl && (currentEl as any)._card ? currentEl : (feed.querySelector('.card:not(.plain)') as HTMLElement | null);
  if (!el) return;
  if (el !== currentEl) { feed.scrollTo({ top: el.offsetTop, behavior: 'smooth' }); setCurrent(el); }
  const t = cardSpeech((el as any)._card); if (!t) { setCurrent(el); return advanceFeed(); }
  playQueue([{ text: t, label: cardTitle((el as any)._card) || label((el as any)._card) }], true);
}

export function stopAudio() { audioOn = false; audioQueue = []; synth?.cancel(); player?.classList.remove('show'); }

player.querySelector('.pp')!.addEventListener('click', e => {
  if (synth.paused) { synth.resume(); (e.currentTarget as HTMLElement).textContent = 'Pause'; } else { synth.pause(); (e.currentTarget as HTMLElement).textContent = 'Play'; }
});
player.querySelector('.stop')!.addEventListener('click', stopAudio);
player.querySelector('.skip-card')!.addEventListener('click', () => { synth.cancel(); audioQueue = []; if (feedMode) advanceFeed(); else stopAudio(); });
document.getElementById('listenBtn')!.addEventListener('click', () => (audioOn ? stopAudio() : listenFeed()));
