/* Your week: the last 7 days from the stats kept on this phone (time, stories, things learned, editions finished,
   quizzes and languages), compared with the week before. Opens from Profile and from the done screen. */
import { S, today, addDays, type DayStats } from './state';
import { esc, plural, ICON } from './ui';
import { go } from './nav';
import { PACKS } from './languages';
import * as srs from './srs';
import { quizHistory } from './dailyquiz';

const EMPTY: DayStats = { read: 0, learned: 0, quizRight: 0, quizDone: 0, secs: 0, opened: 0, finished: 0 };
const sum = (days: DayStats[], k: keyof DayStats) => days.reduce((a, d) => a + d[k], 0);
const dur = (secs: number) => { const m = Math.round(secs / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`; };

export function weekStats(end = today()) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(end, i - 6));
  const days = dates.map(d => S.stats[d] || EMPTY);
  const prev = Array.from({ length: 7 }, (_, i) => S.stats[addDays(end, i - 13)] || EMPTY);
  const qh = quizHistory();
  const dq = dates.map(d => qh[d]).filter(Boolean) as [number, number][];
  return {
    dates, days,
    secs: sum(days, 'secs'), read: sum(days, 'read'), learned: sum(days, 'learned'), finished: sum(days, 'finished'),
    quizRight: sum(days, 'quizRight'), quizDone: sum(days, 'quizDone'),
    active: days.filter(d => d.secs > 60 || d.read || d.learned).length,
    prevRead: sum(prev, 'read'), prevLearned: sum(prev, 'learned'),
    dailyQuiz: dq,
  };
}

function compare(now: number, before: number, what: string) {
  if (!before) return '';
  const d = now - before;
  return d > 0 ? `${d} more ${what} than the week before` : d < 0 ? `${-d} fewer ${what} than the week before` : `The same number of ${what} as the week before`;
}

export function openRecap() {
  go('profile');
  const el = document.getElementById('page')!;
  el.scrollTop = 0;
  document.title = 'Your week · Knowfeed';
  const w = weekStats();
  const maxSecs = Math.max(...w.days.map(d => d.secs), 60);
  const dayName = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
  const range = `${new Date(w.dates[0] + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${new Date(w.dates[6] + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const langs = (S.profile?.languages || []).filter(l => PACKS[l.name]?.length).map(l => ({ name: l.name, ...srs.progress(l.name, PACKS[l.name]) }));
  const dqRight = w.dailyQuiz.reduce((a, [r]) => a + r, 0), dqTotal = w.dailyQuiz.reduce((a, [, t]) => a + t, 0);
  const quiz = w.quizDone ? `${w.quizRight}/${w.quizDone}` : '–';
  const lines = [compare(w.read, w.prevRead, 'stories'), compare(w.learned, w.prevLearned, 'things learned')].filter(Boolean);
  const empty = !w.secs && !w.read && !w.learned;
  el.innerHTML = `<button class="pback" data-back>${ICON.back}<span>Profile</span></button>
    <header class="phead"><h1>Your week</h1><p>${esc(range)}</p></header>
    ${empty ? '<section class="psec"><p class="note">Nothing yet this week. Your time, stories and learning will show here as you go.</p></section>' : `
    <section class="psec"><div class="rtiles">
      <div><b>${esc(dur(w.secs))}</b><span>reading</span></div>
      <div><b>${w.read}</b><span>${w.read === 1 ? 'story' : 'stories'} read</span></div>
      <div><b>${w.learned}</b><span>${w.learned === 1 ? 'thing' : 'things'} learned</span></div>
      <div><b>${w.finished}</b><span>${w.finished === 1 ? 'edition' : 'editions'} finished</span></div>
      <div><b>${quiz}</b><span>quiz answers right</span></div>
      <div><b>${w.active}</b><span>of 7 days</span></div>
    </div>
    ${lines.length ? `<p class="note rcomp">${lines.map(esc).join('. ')}.</p>` : ''}</section>
    <section class="psec"><h2>Time each day</h2><div class="rbars" role="img" aria-label="${esc(w.dates.map((d, i) => `${dayName(d)}: ${dur(w.days[i].secs)}`).join(', '))}">${w.dates.map((d, i) => `<div class="rbar${d === today() ? ' now' : ''}"><i style="height:${Math.max(3, Math.round((w.days[i].secs / maxSecs) * 100))}%"></i><span>${esc(dayName(d).charAt(0))}</span></div>`).join('')}</div></section>
    ${dqTotal ? `<section class="psec"><h2>Daily quiz</h2><p class="note">${dqRight} of ${dqTotal} right over ${plural(w.dailyQuiz.length, 'day')}.</p></section>` : ''}
    ${langs.length ? `<section class="psec"><h2>Languages</h2><div class="rows">${langs.map(l => `<div class="row static"><span class="rt"><b>${esc(l.name)}</b><span class="rs">${l.seen} of ${l.total} phrases met${l.learned ? `, ${l.learned} learned for good` : ''}</span></span></div>`).join('')}</div></section>` : ''}
    <section class="psec"><div class="choices"><button class="cta small" data-share>${ICON.share} Share my week</button></div></section>`}`;
  el.querySelector('[data-back]')!.addEventListener('click', () => go('profile'));
  el.querySelector('[data-share]')?.addEventListener('click', () => import('./share').then(m => m.shareSpec({
    kicker: 'My week on Knowfeed', topic: 'general', seed: `week-${today()}`, url: 'https://knowfeed-nine.vercel.app', file: 'my-knowfeed-week.png',
    title: `${plural(w.learned, 'thing')} learned and ${plural(w.read, 'story', 'stories')} read this week`,
    sub: [w.finished ? `${plural(w.finished, 'edition')} finished` : '', langs[0] ? `${langs[0].name}: ${langs[0].seen} phrases` : ''].filter(Boolean).join(' · ') || undefined,
  })));
}
