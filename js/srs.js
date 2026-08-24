// Simplified SM-2 spaced repetition scheduler.
// quality: 'again' | 'hard' | 'good' | 'easy'
const QUALITY_SCORE = { again: 1, hard: 3, good: 4, easy: 5 };

const DAY_MS = 86400000;

export function freshEntry() {
  return { ease: 2.5, interval: 0, reps: 0, mastery: 0, lastReviewed: null, nextReview: null };
}

export function schedule(entry, qualityLabel) {
  const prev = entry || freshEntry();
  const q = QUALITY_SCORE[qualityLabel] ?? 3;
  let { ease, interval, reps } = prev;

  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ease);
    reps += 1;
  }

  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const now = Date.now();
  const nextReview = now + interval * DAY_MS;
  const mastery = masteryFromReps(reps, q);

  return { ease, interval, reps, mastery, lastReviewed: now, nextReview };
}

function masteryFromReps(reps, lastQuality) {
  if (lastQuality < 3) return Math.max(0, 1);
  if (reps <= 1) return 1;
  if (reps === 2) return 2;
  if (reps <= 4) return 3;
  return 4; // mastered
}

export function isDue(entry) {
  if (!entry || !entry.nextReview) return true; // never reviewed = due
  return entry.nextReview <= Date.now();
}

export const MASTERY_LABELS = ['New', 'Learning', 'Familiar', 'Known', 'Mastered'];
