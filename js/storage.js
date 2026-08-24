// Local-only persistence layer. Backed by localStorage (single user, no login,
// small data volume) with an in-memory fallback if storage is unavailable
// (e.g. Safari private mode).
const STORAGE_KEY = 'vorbeste:v1';

function defaultState() {
  return {
    progress: {},       // phraseId -> { ease, interval, reps, mastery, lastReviewed, nextReview }
    streak: { current: 0, longest: 0, lastActiveDate: null },
    translatorLog: [],  // { id, ts, term, translation, direction, suggestedPhase }
    settings: {
      googleTtsKey: '',
      anthropicKey: '',
      aiModel: 'claude-opus-5',
      theme: 'system'
    },
    chats: {}            // scenarioId -> [{ role, ro, en, ts }]
  };
}

let memoryState = null;
let storageAvailable = true;
try {
  const testKey = '__vorbeste_test__';
  localStorage.setItem(testKey, '1');
  localStorage.removeItem(testKey);
} catch (e) {
  storageAvailable = false;
}

function load() {
  if (!storageAvailable) return memoryState || (memoryState = defaultState());
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed, {
      progress: Object.assign({}, parsed.progress),
      streak: Object.assign({ current: 0, longest: 0, lastActiveDate: null }, parsed.streak),
      settings: Object.assign(defaultState().settings, parsed.settings)
    });
  } catch (e) {
    return defaultState();
  }
}

function save(state) {
  if (!storageAvailable) { memoryState = state; return; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* quota or private-mode failure: silently skip persistence */ }
}

export const Store = {
  getState() { return load(); },

  getProgress(phraseId) {
    const state = load();
    return state.progress[phraseId] || null;
  },

  setProgress(phraseId, entry) {
    const state = load();
    state.progress[phraseId] = entry;
    save(state);
  },

  getAllProgress() {
    return load().progress;
  },

  getSettings() {
    return load().settings;
  },

  setSetting(key, value) {
    const state = load();
    state.settings[key] = value;
    save(state);
  },

  getStreak() {
    return load().streak;
  },

  touchStreak() {
    const state = load();
    const today = new Date().toISOString().slice(0, 10);
    const { lastActiveDate, current, longest } = state.streak;
    if (lastActiveDate === today) return state.streak;
    let nextCurrent = 1;
    if (lastActiveDate) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (lastActiveDate === yesterday) nextCurrent = current + 1;
    }
    state.streak = {
      current: nextCurrent,
      longest: Math.max(longest, nextCurrent),
      lastActiveDate: today
    };
    save(state);
    return state.streak;
  },

  logTranslatorLookup(entry) {
    const state = load();
    const record = Object.assign({ id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now() }, entry);
    state.translatorLog.unshift(record);
    state.translatorLog = state.translatorLog.slice(0, 500);
    save(state);
    return record;
  },

  getTranslatorLog() {
    return load().translatorLog;
  },

  getChat(scenarioId) {
    const state = load();
    return state.chats[scenarioId] || [];
  },

  appendChat(scenarioId, message) {
    const state = load();
    if (!state.chats[scenarioId]) state.chats[scenarioId] = [];
    state.chats[scenarioId].push(message);
    save(state);
  },

  clearChat(scenarioId) {
    const state = load();
    state.chats[scenarioId] = [];
    save(state);
  },

  resetAll() {
    save(defaultState());
  },

  exportJSON() {
    return JSON.stringify(load(), null, 2);
  }
};
