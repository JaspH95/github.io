/* Finite learning sessions: a 5-minute language lesson, a quick review of due items and the daily quiz.
   Each one ends; starting another is always a choice. Quiz questions come only from the phrase pack. */
import { S, bump, day, today } from './state';
import { esc, ICON, toast } from './ui';
import { PACKS, phraseOfDay, nextNew, progressLine, LANG_CODE } from './languages';
import * as srs from './srs';
import { speakIn } from './audio';
import { loadSkill } from './cards';
import { log } from './events';
import { dailyQuestions, quizResult, saveQuizResult, type DQ } from './dailyquiz';
import type { Phrase } from './types';

type Step =
  | { t: 'intro'; title: string; sub: string }
  | { t: 'new'; lang: string; p: Phrase }
  | { t: 'recall'; key: string; lang?: string; p?: Phrase; quiz?: srs.Item['quiz']; skill?: { id: string; label: string } }
  | { t: 'mcq'; lang: string; p: Phrase; opts: string[]; answer: number }
  | { t: 'dq'; q: DQ; n: number }
  | { t: 'end'; title: string; sub: string; again?: () => void };

const box = () => document.getElementById('lesson')!;
let steps: Step[] = [];
let i = 0;
let kind: 'lesson' | 'review' | 'quiz' = 'lesson';
let score = 0;
const KICKER = { lesson: 'Language lesson', review: 'Review', quiz: 'Daily quiz' };

function shuffle<T>(xs: T[]): T[] { const a = xs.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; }

/* Cards in the feed ask for a lesson with an event, so they don't need to import this file */
document.addEventListener('kf-lesson', e => startLesson((e as CustomEvent<string>).detail));

export function startLesson(lang: string) {
  const l = S.profile?.languages.find(x => x.name === lang);
  const pack = PACKS[lang] || [];
  if (!pack.length) { toast(`The ${lang} phrase pack isn't ready yet`); return; }
  const pod = phraseOfDay(lang, l?.goal, l?.level);
  // Today's phrase of the day counts as new, then the next phrases you haven't met
  const podNew = pod && srs.get(srs.phraseKey(lang, pod))?.seen === today() ? [pod] : [];
  const fresh = [...podNew, ...nextNew(lang, 3, l?.goal, l?.level)].slice(0, 3);
  const reviews = srs.due({ kind: 'phrase', lang, max: 5, perLang: 5 });
  const known = pack.filter(p => srs.get(srs.phraseKey(lang, p)) || fresh.includes(p));
  const quizFrom = shuffle(known).slice(0, 3);
  steps = [
    { t: 'intro', title: `${lang} in 5 minutes`, sub: [fresh.length && `${fresh.length} new phrase${fresh.length > 1 ? 's' : ''}`, reviews.length && `${reviews.length} to review`, quizFrom.length && 'a quick quiz'].filter(Boolean).join(', ') + '.' },
    ...fresh.map(p => ({ t: 'new' as const, lang, p })),
    ...reviews.map(r => ({ t: 'recall' as const, key: r.key, lang, p: pack.find(p => srs.phraseKey(lang, p) === r.key) })).filter(s => s.p),
    ...quizFrom.map(p => {
      const wrong = shuffle(pack.filter(x => x.id !== p.id && x.meaning !== p.meaning)).slice(0, 2).map(x => x.meaning);
      const opts = shuffle([p.meaning, ...wrong]);
      return { t: 'mcq' as const, lang, p, opts, answer: opts.indexOf(p.meaning) };
    }),
    { t: 'end', title: 'Lesson done.', sub: progressLine(lang), again: () => startLesson(lang) },
  ];
  kind = 'lesson'; i = 0; open(); log('lesson_start', { lang });
}

export function startReview() {
  const items = srs.due({ max: 5, perLang: 5 });
  if (!items.length) { toast('Nothing to review right now. Come back tomorrow'); return; }
  const recall: Step[] = [];
  for (const it of items) {
    if (it.kind === 'phrase') { const [, lang, id] = it.key.split(':'); const p = PACKS[lang]?.find(x => x.id === id); if (p) recall.push({ t: 'recall', key: it.key, lang, p }); }
    else if (it.kind === 'quiz' && it.quiz) recall.push({ t: 'recall', key: it.key, quiz: it.quiz });
    else if (it.kind === 'skill' && it.skill) recall.push({ t: 'recall', key: it.key, skill: it.skill });
  }
  steps = [{ t: 'intro', title: 'Quick review', sub: `${recall.length} thing${recall.length > 1 ? 's' : ''} you've learned, due for a check.` }, ...recall, { t: 'end', title: 'Review done.', sub: 'Each one comes back later, a little further apart each time.' }];
  kind = 'review'; i = 0; open(); log('review_start', { n: recall.length });
}

/* The daily quiz: five questions from Wikidata and Wikipedia, the same five all day. Done once a day. */
export function startDailyQuiz() {
  const done = quizResult();
  if (done) { toast(`You got ${done.right} of ${done.total} today. A new quiz comes tomorrow`); return; }
  const qs = dailyQuestions();
  if (qs.length < 3) { toast("Today's quiz isn't ready yet. Try again later"); return; }
  steps = [
    { t: 'intro', title: "Today's quiz", sub: `${qs.length} questions from Wikipedia and Wikidata, with the answer and source after each one.` },
    ...qs.map((q, n) => ({ t: 'dq' as const, q, n })),
    { t: 'end', title: '', sub: '' },
  ];
  kind = 'quiz'; score = 0; i = 0; open(); log('quiz_start', { n: qs.length });
}
document.addEventListener('kf-quiz', () => startDailyQuiz());

function open() {
  const b = box();
  b.classList.add('open');
  b.setAttribute('aria-hidden', 'false');
  draw();
}
export function closeLesson() { const b = box(); b.classList.remove('open'); b.setAttribute('aria-hidden', 'true'); }

function next() { i = Math.min(steps.length - 1, i + 1); draw(); }

function phraseBlock(lang: string, p: Phrase) {
  return `${p.checked ? '' : '<span class="unchecked">Not yet checked</span>'}<h2 class="phrase" lang="${esc(LANG_CODE[lang] || '')}">${esc(p.phrase)}</h2>${p.romanisation ? `<p class="roman">${esc(p.romanisation)}</p>` : ''}<p class="say">Say it: <b>${esc(p.say)}</b></p>
    <div class="choices"><button class="choice hear">${ICON.speaker} Hear it</button><button class="choice slow">Slowly</button></div>`;
}

function draw() {
  const s = steps[i];
  const b = box();
  const dots = steps.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('');
  let body = '';
  switch (s.t) {
    case 'intro': body = `<p class="kicker">${KICKER[kind]}</p><h2 class="display">${esc(s.title)}</h2><p class="lead">${esc(s.sub)}</p><button class="cta go">Start</button>`; break;
    case 'new': body = `<p class="kicker">New phrase · ${esc(s.lang)}</p>${phraseBlock(s.lang, s.p)}<p class="lead"><b>${esc(s.p.meaning)}</b>. ${esc(s.p.when)}</p>${s.p.notes ? `<p class="note">${esc(s.p.notes)}</p>` : ''}<button class="cta go">Next</button>`; break;
    case 'recall': {
      const q = s.p ? s.p.meaning : s.quiz ? s.quiz.q : `Do you remember what “${s.skill!.label}” means?`;
      const reveal = s.p ? phraseBlock(s.lang!, s.p) : s.quiz ? `<p class="lead">${s.quiz.prompt ? esc(s.quiz.prompt) + '<br>' : ''}<b>${esc(s.quiz.opts[s.quiz.answer])}</b></p><p class="note">${esc(s.quiz.explain)}</p>` : '<p class="lead skill-r">Loading…</p>';
      body = `<p class="kicker">Remember this?${s.lang ? ` · ${esc(s.lang)}` : ''}</p><h2>${esc(q)}</h2><button class="cta ghost show">Show the answer</button><div class="reveal">${reveal}<div class="choices grade"><button class="choice yes got">Got it</button><button class="choice notyet">Not yet</button></div></div>`;
      break;
    }
    case 'mcq': body = `<p class="kicker">Quick quiz · ${esc(s.lang)}</p><h2 class="phrase" lang="${esc(LANG_CODE[s.lang] || '')}">${esc(s.p.phrase)}</h2><p class="lead">What does it mean?</p><div class="opts">${s.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div><button class="cta go hidden">Next</button>`; break;
    case 'dq': body = `<p class="kicker">Daily quiz · ${s.n + 1} of ${steps.length - 2}</p><h2>${esc(s.q.q)}</h2>${s.q.prompt ? `<p class="lead">${esc(s.q.prompt)}</p>` : ''}<div class="opts">${s.q.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div><div class="reveal dq-why"><p class="note">${esc(s.q.explain)} <a href="${esc(s.q.source.url)}" target="_blank" rel="noopener">Source: ${esc(s.q.source.name)}</a></p></div><button class="cta go hidden">${s.n + 3 === steps.length ? 'See your score' : 'Next'}</button>`; break;
    case 'end': {
      if (kind === 'quiz') {
        const total = steps.length - 2;
        const line = score === total ? 'Every one right.' : score >= total / 2 ? 'Nicely done.' : 'Each one is a new thing learned.';
        body = `<p class="kicker">Daily quiz</p><h2 class="display">${score} of ${total}</h2><p class="lead">${line} A new quiz comes tomorrow.</p><div class="choices"><button class="cta share-q">${ICON.share} Share my score</button><button class="cta ghost close-l">Back</button></div>`;
        break;
      }
      body = `<p class="kicker">${KICKER[kind]}</p><h2 class="display">${esc(s.title)}</h2><p class="lead">${esc(s.sub)}</p><p class="note">Learned today: ${day().learned}</p><div class="choices">${s.again ? '<button class="cta again">Another lesson</button>' : ''}<button class="cta ghost close-l">Back</button></div>`; break;
    }
  }
  b.innerHTML = `<div class="aurora soft"></div><header class="lhead"><button class="circ glass x" aria-label="Close">${ICON.close}</button><div class="dots" aria-hidden="true">${dots}</div></header><div class="lbody">${body}</div>`;
  b.querySelector('.x')!.addEventListener('click', closeLesson);
  b.querySelector('.go')?.addEventListener('click', () => {
    if (s.t === 'new') { srs.add(srs.phraseKey(s.lang, s.p), 'phrase', { lang: s.lang }); bump('learned'); }
    next();
  });
  if (s.t === 'new' || s.t === 'recall' && s.p) {
    const lang = (s as any).lang as string, p = (s as any).p as Phrase;
    b.querySelectorAll('.hear').forEach(x => x.addEventListener('click', () => speakIn(p.phrase, lang, 0.9)));
    b.querySelectorAll('.slow').forEach(x => x.addEventListener('click', () => speakIn(p.phrase, lang, 0.55)));
  }
  if (s.t === 'recall') {
    b.querySelector('.show')!.addEventListener('click', e => {
      (e.currentTarget as HTMLElement).remove(); b.querySelector('.reveal')!.classList.add('show');
      if (s.skill) loadSkill(s.skill.id).then(k => { const el = b.querySelector('.skill-r'); if (el) el.textContent = k?.description || "Couldn't load the description just now."; });
    });
    const grade = (ok: boolean) => { srs.answer(s.key, ok); if (ok) bump('learned'); next(); };
    b.querySelector('.got')!.addEventListener('click', () => grade(true));
    b.querySelector('.notyet')!.addEventListener('click', () => grade(false));
  }
  if (s.t === 'mcq') {
    b.querySelectorAll<HTMLButtonElement>('.opt').forEach(o => o.addEventListener('click', () => {
      if (b.dataset.answered === String(i)) return; b.dataset.answered = String(i);
      const k = +o.dataset.k!;
      b.querySelectorAll<HTMLButtonElement>('.opt').forEach(x => { const xk = +x.dataset.k!; if (xk === s.answer) x.classList.add('right'); else if (xk === k) x.classList.add('wrong'); });
      bump('quizDone'); if (k === s.answer) bump('quizRight');
      else { const key = srs.phraseKey(s.lang, s.p); if (srs.get(key)) srs.answer(key, false); }
      b.querySelector('.go')!.classList.remove('hidden');
    }));
  }
  if (s.t === 'dq') {
    b.querySelectorAll<HTMLButtonElement>('.opt').forEach(o => o.addEventListener('click', () => {
      if (b.dataset.answered === String(i)) return; b.dataset.answered = String(i);
      const k = +o.dataset.k!;
      b.querySelectorAll<HTMLButtonElement>('.opt').forEach(x => { const xk = +x.dataset.k!; x.disabled = true; if (xk === s.q.answer) x.classList.add('right'); else if (xk === k) x.classList.add('wrong'); });
      bump('quizDone'); if (k === s.q.answer) { bump('quizRight'); score++; }
      b.querySelector('.dq-why')!.classList.add('show');
      b.querySelector('.go')!.classList.remove('hidden');
      (b.querySelector('.go') as HTMLElement).focus({ preventScroll: true });
    }));
  }
  if (s.t === 'end' && kind === 'quiz') {
    const total = steps.length - 2;
    if (!quizResult()) { saveQuizResult(score, total); bump('learned', score); log('quiz_finish', { right: score, total }); document.dispatchEvent(new CustomEvent('kf-quiz-done')); }
    b.querySelector('.share-q')?.addEventListener('click', () => import('./share').then(m => m.shareSpec({ kicker: 'Daily quiz', topic: 'general', seed: `quiz-${today()}`, title: `I got ${score} out of ${total} in today's Knowfeed quiz`, sub: 'Five questions from Wikipedia and Wikidata. Can you beat it?', url: 'https://knowfeed-nine.vercel.app', file: 'knowfeed-quiz.png' })));
    b.querySelector('.close-l')!.addEventListener('click', closeLesson);
  } else if (s.t === 'end') {
    log(kind === 'lesson' ? 'lesson_finish' : 'review_finish', {});
    b.querySelector('.again')?.addEventListener('click', () => s.again?.());
    b.querySelector('.close-l')!.addEventListener('click', closeLesson);
  }
}
