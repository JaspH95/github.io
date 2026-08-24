import { Store } from './storage.js';

let voicesReady = null;
function getVoices() {
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) return resolve(existing);
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
    // Safari sometimes never fires the event — fall back after a short wait.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 700);
  });
  return voicesReady;
}

async function speakWithGoogleCloud(text, apiKey) {
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'ro-RO', ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3' }
    })
  });
  if (!res.ok) throw new Error(`Google TTS error: ${res.status}`);
  const data = await res.json();
  const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
  await audio.play();
  return 'google';
}

async function speakWithBrowser(text) {
  if (!('speechSynthesis' in window)) throw new Error('no-speech-synthesis');
  const voices = await getVoices();
  const roVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('ro'));
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ro-RO';
  if (roVoice) utter.voice = roVoice;
  utter.rate = 0.92;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  return roVoice ? 'browser-ro-voice' : 'browser-no-ro-voice';
}

// Returns which engine served the audio, or throws if nothing could play.
export async function speak(text) {
  const { googleTtsKey } = Store.getSettings();
  if (googleTtsKey) {
    try {
      return await speakWithGoogleCloud(text, googleTtsKey);
    } catch (e) {
      // fall through to browser TTS
    }
  }
  return speakWithBrowser(text);
}

export async function hasRomanianVoice() {
  const voices = await getVoices();
  return voices.some((v) => v.lang && v.lang.toLowerCase().startsWith('ro'));
}
