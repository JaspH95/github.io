const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isSupported() {
  return !!SpeechRecognitionImpl;
}

// Returns a controller: { start(), stop() }. Callbacks: onResult(transcript, isFinal), onError(err), onEnd()
export function createRecognizer({ onResult, onError, onEnd, lang = 'ro-RO' } = {}) {
  if (!SpeechRecognitionImpl) {
    return {
      start() { onError && onError(new Error('speech-recognition-unsupported')); },
      stop() {}
    };
  }
  const recognition = new SpeechRecognitionImpl();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    let transcript = '';
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    onResult && onResult(transcript.trim(), isFinal);
  };
  recognition.onerror = (event) => { onError && onError(new Error(event.error || 'speech-recognition-error')); };
  recognition.onend = () => { onEnd && onEnd(); };

  return {
    start() { try { recognition.start(); } catch (e) { /* already started */ } },
    stop() { try { recognition.stop(); } catch (e) { /* not started */ } }
  };
}
