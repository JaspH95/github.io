// Loads phase metadata + phrase banks and exposes lookup helpers.
let metaCache = null;
const phaseCache = {};

export async function loadPhasesMeta() {
  if (metaCache) return metaCache;
  const res = await fetch('data/phases-meta.json');
  const data = await res.json();
  metaCache = data.phases;
  return metaCache;
}

export async function loadPhase(phaseId) {
  if (phaseCache[phaseId]) return phaseCache[phaseId];
  const res = await fetch(`data/phases/phase${phaseId}.json`);
  const data = await res.json();
  phaseCache[phaseId] = data;
  return data;
}

export async function loadAllPhases() {
  const meta = await loadPhasesMeta();
  const all = await Promise.all(meta.map((m) => loadPhase(m.id)));
  return all;
}

export async function getPhraseById(phraseId) {
  const phaseNum = phraseId.split('-')[0].replace('p', '');
  const phase = await loadPhase(phaseNum);
  return phase.items.find((i) => i.id === phraseId) || null;
}

export async function getAllLearnableItems() {
  const meta = await loadPhasesMeta();
  const built = meta.filter((m) => m.status === 'complete');
  const phases = await Promise.all(built.map((m) => loadPhase(m.id)));
  return phases.flatMap((p) => p.items.map((item) => Object.assign({ phase: p.phase }, item)));
}
