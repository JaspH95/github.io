/* Onboarding and the settings chat share one screen. Both run on the device with no AI. Ported from the prototype. */
import { S, saveAll } from './state';
import { TOPICS, PICKABLE, RELATED, WORK, SPORTS, CLUBS, UK_CITIES, WORLD_CITIES, LANG_OPTS, LANG_CODES } from './content';
import { wait } from './util';
import { closeArticle } from './article';
import { refresh, data } from './feed';
import { progress, reviewAllAgain, hasPack } from './phrases';
import type { TopicKey } from './types';

const onb = document.getElementById('onb')!, lines = document.getElementById('lines')!, stream = document.getElementById('stream')!, otray = document.getElementById('otray')!, orb = document.getElementById('orb')!;
let fast = false;
stream.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('button,input')) fast = true; });
const toBottom = () => { stream.scrollTop = stream.scrollHeight; };

/* Keyboard handling: driven by input focus, so it works even where the viewport doesn't report the keyboard */
function setPad() { lines.style.setProperty('--pad', onb.classList.contains('kb') ? '10px' : Math.round(stream.clientHeight * 0.4) + 'px'); }
function fit() {
  const vv = window.visualViewport;
  if (vv) { onb.style.height = vv.height + 'px'; onb.style.transform = `translateY(${vv.offsetTop}px)`; }
  setPad();
}
if (window.visualViewport) { visualViewport!.addEventListener('resize', () => { fit(); keepQuestion(); }); visualViewport!.addEventListener('scroll', fit); }
window.addEventListener('resize', () => { if (onb.classList.contains('open')) setPad(); });
/* Put the start of the latest question at the top of the visible area, with the input right under it */
function keepQuestion() {
  const form = lines.querySelector<HTMLElement>('.oform'); if (!form) return toBottom();
  let q = form.previousElementSibling as HTMLElement | null; while (q && q.classList.contains('ans')) q = q.previousElementSibling as HTMLElement | null;
  const target = q ? q.offsetTop - 30 : form.offsetTop - 120;
  stream.scrollTop = Math.max(0, Math.min(target, form.offsetTop + form.offsetHeight - stream.clientHeight + 16));
}
function kbOn() { onb.classList.add('kb'); fit(); setTimeout(() => { fit(); keepQuestion(); }, 120); setTimeout(() => { fit(); keepQuestion(); }, 450); }
function kbOff() { setTimeout(() => { if (!onb.contains(document.activeElement) || document.activeElement?.tagName !== 'INPUT') { onb.classList.remove('kb'); fit(); } }, 120); }

const IC: Record<string, string> = {
  chip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M2 20h20"/></svg>',
  db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
  mega: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10v4h4l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>',
  cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  time: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
};

function pastAll() { lines.querySelectorAll('.ln:not(.past)').forEach(n => n.classList.add('past')); }
function place(node: HTMLElement) { const f = lines.querySelector('.oform.chatbox'); f ? lines.insertBefore(node, f) : lines.appendChild(node); }
/* Each line types out, then drifts up and fades as the next one arrives */
async function say(text: string, cls = '') {
  const n = document.createElement('p'); n.className = 'ln ' + cls; place(n);
  orb.classList.add('talk'); fast = false;
  for (let i = 1; i <= text.length; i++) { if (fast) { n.textContent = text; break; } n.textContent = text.slice(0, i); if (i % 4 === 0) toBottom(); await wait(20); }
  orb.classList.remove('talk'); toBottom(); await wait(fast ? 80 : 380);
  return n;
}
function answer(text: string) { stream.classList.remove('choosing'); const n = document.createElement('p'); n.className = 'ln ans'; n.textContent = text; place(n); toBottom(); }
function showQ(box: HTMLElement) {
  const q = box.previousElementSibling as HTMLElement | null; if (!q) return toBottom();
  stream.classList.add('choosing');
  const max = stream.scrollHeight - stream.clientHeight;
  stream.scrollTop = Math.min(max, Math.max(0, q.offsetTop - 64));
}
function makeForm(placeholder: string, cls = '') {
  const f = document.createElement('form'); f.className = 'oform inline ' + cls;
  f.innerHTML = `<input aria-label="Your answer" autocomplete="off" enterkeyhint="send" maxlength="300"><button class="osend" aria-label="Send"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>`;
  const input = f.querySelector('input')!;
  input.placeholder = placeholder;
  input.addEventListener('focus', kbOn); input.addEventListener('blur', kbOff);
  return f;
}
/* The text box sits directly under the question, so the question can never hide behind the keyboard */
function askText(placeholder: string): Promise<string> {
  return new Promise(res => {
    const f = makeForm(placeholder); lines.appendChild(f); toBottom();
    const input = f.querySelector('input')!; input.maxLength = 40;
    f.addEventListener('submit', e => {
      e.preventDefault(); const v = input.value.trim(); if (!v) return;
      input.blur(); f.remove(); onb.classList.remove('kb'); fit(); answer(v); res(v);
    });
  });
}
function askOne(opts: [string, string, string?][]): Promise<string> {
  return new Promise(res => {
    const box = document.createElement('div'); box.className = 'olist';
    opts.forEach(([k, l, ic], i) => {
      const b = document.createElement('button'); b.className = 'po'; b.style.animationDelay = `${i * 40}ms`; b.innerHTML = `${ic ? IC[ic] : ''}<span></span>`; b.querySelector('span')!.textContent = l;
      b.addEventListener('click', () => { box.remove(); answer(l); res(k); }); box.appendChild(b);
    });
    lines.appendChild(box); showQ(box);
  });
}
function askMany(opts: [string, string][], btnLabel: string, noneLabel?: string, preset: string[] = []): Promise<string[]> {
  return new Promise(res => {
    const picked = new Set(preset); const box = document.createElement('div'); box.className = 'olist';
    const lab = Object.fromEntries(opts);
    otray.innerHTML = '<button class="glow-btn"></button>';
    const go = otray.querySelector<HTMLButtonElement>('.glow-btn')!;
    const update = () => { go.disabled = !picked.size && !noneLabel && !preset.length; go.textContent = picked.size ? (preset.length ? btnLabel : `${btnLabel} (${picked.size})`) : (noneLabel || btnLabel); };
    opts.forEach(([k, l], i) => {
      const b = document.createElement('button'); b.className = 'po'; b.style.animationDelay = `${i * 35}ms`; b.setAttribute('aria-pressed', String(picked.has(k))); b.innerHTML = '<span></span><span class="tick"></span>'; b.querySelector('span')!.textContent = l;
      b.addEventListener('click', () => { picked.has(k) ? picked.delete(k) : picked.add(k); b.setAttribute('aria-pressed', String(picked.has(k))); update(); });
      box.appendChild(b);
    });
    lines.appendChild(box); update();
    go.addEventListener('click', () => { const keys = [...picked]; box.remove(); otray.innerHTML = ''; answer(keys.length ? keys.map(k => lab[k]).join(', ') : noneLabel || 'None'); res(keys); });
    showQ(box);
  });
}
function askTeams(preset: string[] = []): Promise<string[]> {
  return new Promise(res => {
    const picked = new Set<string>(); const box = document.createElement('div'); box.className = 'olist';
    const form = makeForm('Type another team'); form.classList.add('team-add');
    otray.innerHTML = '<button class="glow-btn">No particular team</button>';
    const go = otray.querySelector<HTMLButtonElement>('.glow-btn')!;
    const update = () => { go.textContent = picked.size ? `Follow ${picked.size} team${picked.size > 1 ? 's' : ''}` : 'No particular team'; };
    const addChip = (name: string, on: boolean) => {
      const b = document.createElement('button'); b.className = 'po'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.innerHTML = '<span></span><span class="tick"></span>'; b.querySelector('span')!.textContent = name;
      if (on) picked.add(name);
      b.addEventListener('click', () => { picked.has(name) ? picked.delete(name) : picked.add(name); b.setAttribute('aria-pressed', String(picked.has(name))); update(); });
      box.insertBefore(b, form);
    };
    form.addEventListener('submit', e => { e.preventDefault(); const i = form.querySelector('input')!; const v = i.value.trim().slice(0, 30); if (v && !picked.has(v)) { addChip(v, true); update(); } i.value = ''; });
    box.appendChild(form);
    [...CLUBS, ...preset.filter(t => !CLUBS.includes(t))].forEach(c => addChip(c, preset.includes(c)));
    lines.appendChild(box); update();
    go.addEventListener('click', () => { (document.activeElement as HTMLElement | null)?.blur?.(); onb.classList.remove('kb'); fit(); box.remove(); otray.innerHTML = ''; answer(picked.size ? [...picked].join(', ') : 'No particular team'); res([...picked]); });
    showQ(box);
  });
}
async function askCity() {
  let city = await askOne([...UK_CITIES.map(c => [c, c, 'pin'] as [string, string, string]), ['__world', 'Outside the UK', 'globe']]);
  if (city === '__world') { pastAll(); await say('Which of these is closest?'); city = await askOne(WORLD_CITIES.map(c => [c, c, 'pin'])); }
  return city;
}

function openScreen(mode: 'setup' | 'chat') {
  closeArticle(); lines.innerHTML = ''; otray.innerHTML = '';
  onb.classList.toggle('chat', mode === 'chat');
  onb.classList.remove('fade', 'kb'); onb.classList.add('open'); fit(); setPad();
}

function setLangs(list: string[]) {
  S.profile = { ...(S.profile || { name: '', place: '', work: '', mins: 15, sports: [], teams: [] }), langs: list };
  S.weights.lang = list.some(l => LANG_CODES[l]) ? 3 : 0;
  if (list.includes('British Sign Language')) S.weights.sign = Math.max(S.weights.sign || 0, 3);
  saveAll();
}

let running = false;
export async function startOnboarding() {
  if (running) return; running = true;
  openScreen('setup');
  await wait(400);
  await say("I'm going to ask you a few quick questions. No need to overthink it. Then I'll build your feed.");
  await say('First, what should I call you?');
  const name = await askText('Your first name');
  pastAll(); await say(`Good to meet you, ${name}.`);
  await say('Which major city should I follow for local news? Pick the one nearest you.');
  const city = await askCity();
  pastAll(); await say(`${city} it is. I'll keep you across the big stories there.`);
  await say('What best describes your work?');
  const wkKey = await askOne(WORK.map(x => [x[0], x[1], x[2]]));
  const wk = WORK.find(x => x[0] === wkKey)!;
  pastAll(); await say(wk[4]);
  await say('Which of these would you enjoy learning about? Pick as many as you like.');
  const fun = (await askMany(PICKABLE.map(k => [k, TOPICS[k]]), 'Continue')) as TopicKey[];
  pastAll(); await say(fun.length > 3 ? 'Good mix. Informative, but never dull.' : 'Focused. I like it.');
  await say("Do you follow any sports? I'll bring you news on the ones you pick.");
  const sports = await askMany(SPORTS.map(s => [s, s]), 'Continue', 'Not really');
  let teams: string[] = [];
  if (sports.includes('Football')) {
    pastAll(); await say('Which football teams? Pick from these or type your own.');
    teams = await askTeams();
  }
  pastAll(); await say(teams.length ? `${teams[0]}. I'll keep you posted, good weeks and bad.` : sports.length ? `Nice. I'll keep you across ${sports.slice(0, 2).join(' and ')}${sports.length > 2 ? ' and the rest' : ''}.` : 'No problem. Sport stays out of your feed.');
  await say("Want to learn a language while you scroll? You'll get a phrase of the day.");
  const langs = await askMany(LANG_OPTS.map(l => [l, l]), 'Continue', 'Not right now');
  pastAll(); await say(langs.length ? "A phrase a day adds up faster than you'd think." : 'No problem. You can add one later from the chat.');
  await say("Anything you'd rather skip?");
  const avoid = (await askMany(PICKABLE.filter(k => !fun.includes(k) && !wk[3].includes(k)).map(k => [k, TOPICS[k]]), 'Hide these', "Nothing, I'm open")) as TopicKey[];
  pastAll(); await say(avoid.length ? "Done. You won't see those." : 'Open-minded. Noted.');
  await say('Roughly how long do you scroll each day? Best guess is fine.');
  const mins = +(await askOne([['5', 'Under 10 minutes', 'time'], ['15', '10 to 20 minutes', 'time'], ['25', '20 to 30 minutes', 'time'], ['45', '30 minutes or more', 'time']]));
  pastAll(); await say(`That's around ${Math.round(mins * 365 / 60)} hours a year. Let's make them count.`);
  await say('Building your feed…');
  const bar = document.createElement('div'); bar.className = 'progress'; bar.innerHTML = '<i></i>'; lines.appendChild(bar); toBottom();
  requestAnimationFrame(() => requestAnimationFrame(() => ((bar.firstChild as HTMLElement).style.width = '100%')));
  await wait(1900);

  S.weights = {}; S.accepted = new Set(); S.declined = new Set(avoid);
  wk[3].forEach(t => (S.weights[t] = (S.weights[t] || 0) + 1));
  fun.forEach(t => (S.weights[t] = (S.weights[t] || 0) + 2));
  S.weights.local = (S.weights.local || 0) + 2;
  S.profile = { name, place: city, work: wk[1], mins, sports, teams, langs };
  if (langs.some(l => LANG_CODES[l])) S.weights.lang = 3;
  if (langs.includes('British Sign Language')) S.weights.sign = Math.max(S.weights.sign || 0, 3);
  if (sports.length) S.weights.sport = 3;
  saveAll();

  const top = (Object.entries(S.weights) as [TopicKey, number][]).filter(([t]) => !['local', 'sport', 'lang'].includes(t)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => TOPICS[t]);
  pastAll(); await say(`Local news for ${city}${teams.length ? `, ${teams.slice(0, 2).join(' and ')} updates` : ''}${top.length ? `, plus ${top.join(', ')}` : ''} and a few surprises along the way.`);
  const noPack = langs.filter(l => LANG_CODES[l] && !hasPack(l));
  if (noPack.length) await say(`Your ${noPack.join(' and ')} phrase pack${noPack.length > 1 ? 's are' : ' is'} still being written. Phrases will appear as soon as ${noPack.length > 1 ? 'they land' : 'it lands'}.`);
  await say('You can come back any time from the chat button at the top to change things.');
  await say(`Your feed's ready, ${name}.`, 'big');
  otray.innerHTML = '<button class="glow-btn">Show my feed</button>';
  otray.querySelector('.glow-btn')!.addEventListener('click', closeScreen);
  running = false;
}

async function closeScreen() {
  (document.activeElement as HTMLElement | null)?.blur?.();
  onb.classList.add('fade'); refresh();
  await wait(500); onb.classList.remove('open', 'fade', 'chat', 'kb'); onb.style.transform = ''; onb.style.height = '';
}
document.getElementById('doneBtn')!.addEventListener('click', () => { chatOpen = false; running = false; closeScreen(); });

/* ---------- Chat: change your feed and get suggestions (rule-based) ---------- */
function suggestTopic(): { from: TopicKey | null; to: TopicKey } | null {
  const liked: Partial<Record<TopicKey, number>> = {};
  // Count likes by topic from the cards currently in the feed and saved items
  document.querySelectorAll<HTMLElement>('#feed .card').forEach(el => { const c = (el as any)._card; if (c && S.liked.has(c.id)) liked[c.t as TopicKey] = (liked[c.t as TopicKey] || 0) + 1; });
  const fav = (Object.entries(liked) as [TopicKey, number][]).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const byWeight = (Object.entries(S.weights) as [TopicKey, number][]).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const hasContent = (t: TopicKey) => (data.news?.stories || []).some(s => s.topic === t) || (data.learn?.cards || []).some(c => c.topic === t) || (t === 'hubspot' && !!data.learn?.hubspot?.length);
  const ok = (r: TopicKey) => PICKABLE.includes(r) && !((S.weights[r] || 0) >= 2) && !S.accepted.has(r) && hasContent(r);
  for (const t of [...fav, ...byWeight]) for (const r of RELATED[t] || []) if (ok(r)) return { from: t, to: r };
  const fresh = PICKABLE.filter(ok);
  return fresh.length ? { from: null, to: fresh[Math.floor(Math.random() * fresh.length)] } : null;
}

let chatOpen = false;
export async function openChat() {
  if (running) return;
  running = true; chatOpen = true; openScreen('chat');
  await wait(300);
  const n = S.liked.size;
  await say(`Hi${S.profile?.name ? ' ' + S.profile.name : ''}. You've liked ${n} card${n === 1 ? '' : 's'}${S.later.length ? ` and saved ${S.later.length} for later` : ''}. What would you like to do?`);
  while (chatOpen) {
    const finished = (S.profile?.langs || []).filter(l => hasPack(l) && progress(l).finished);
    const pick = await askOne([
      ['sug', 'Suggest something new', 'dots'], ['topics', 'Change my topics', 'chip'], ['city', 'Change my city', 'pin'],
      ['sport', 'Sports and teams', 'time'], ['lang', finished.length ? 'Languages (pack finished)' : 'Languages', 'globe'], ['done', 'Back to my feed', 'cap'],
    ]);
    if (!chatOpen) break;
    pastAll();
    if (pick === 'done') break;
    if (pick === 'sug') {
      const s = suggestTopic();
      if (!s) { await say("You're already following everything. Keep liking cards and I'll keep tuning your feed."); continue; }
      await say(s.from ? `You've been enjoying ${TOPICS[s.from]}. People who like that often enjoy ${TOPICS[s.to]}. Want to add it?` : `How about ${TOPICS[s.to]}? It's something different from your usual feed.`);
      const yn = await askOne([['y', 'Yes, add it', 'chip'], ['n', 'No thanks', 'dots']]);
      pastAll();
      if (yn === 'y') { S.weights[s.to] = Math.max(S.weights[s.to] || 0, 2); S.declined.delete(s.to); S.accepted.add(s.to); saveAll(); await say(`Added ${TOPICS[s.to]}. You'll see it next time your feed loads.`); }
      else await say('No problem. Anything else?');
      continue;
    }
    if (pick === 'topics') {
      await say('Pick the topics you want in your feed.');
      const on = (await askMany(PICKABLE.map(k => [k, TOPICS[k]]), 'Save topics', undefined, PICKABLE.filter(k => ((S.weights[k] || 0) >= 1 || S.accepted.has(k)) && !S.declined.has(k)))) as TopicKey[];
      PICKABLE.forEach(k => { if (on.includes(k)) { S.weights[k] = Math.max(S.weights[k] || 0, 2); S.declined.delete(k); S.accepted.add(k); } else { S.weights[k] = 0; S.declined.add(k); S.accepted.delete(k); } });
      saveAll(); pastAll(); await say(on.length ? `Done. Your feed now covers ${on.length} topic${on.length > 1 ? 's' : ''}.` : "Done. That's a quiet feed, but it's yours.");
      continue;
    }
    if (pick === 'city') {
      await say('Which major city should I follow for local news?');
      const city = await askCity();
      S.profile = { ...(S.profile || { name: '', work: '', mins: 15, sports: [], teams: [] }), place: city }; saveAll(); pastAll(); await say(`${city} it is.`);
      continue;
    }
    if (pick === 'sport') {
      await say('Which sports do you follow?');
      const sports = await askMany(SPORTS.map(s => [s, s]), 'Save sports', undefined, S.profile?.sports || []);
      let teams = S.profile?.teams || [];
      if (sports.includes('Football')) { pastAll(); await say('Which football teams? Pick from these or type your own.'); teams = await askTeams(teams); } else teams = [];
      S.profile = { ...(S.profile || { name: '', place: '', work: '', mins: 15 }), sports, teams }; S.weights.sport = sports.length ? 3 : 0; saveAll();
      pastAll(); await say(sports.length ? `Following ${[...teams, ...sports.filter(s => s !== 'Football' || !teams.length)].slice(0, 3).join(', ')}${sports.length + teams.length > 3 ? ' and more' : ''}.` : "Sport's out of your feed.");
      continue;
    }
    if (pick === 'lang') {
      if (finished.length) {
        await say(`You've seen every phrase in your ${finished.join(' and ')} pack. What next?`);
        const choice = await askOne([['again', 'Pack finished: review everything again', 'time'], ['new', 'Ask for a new pack', 'chip'], ['change', 'Change my languages', 'globe']]);
        pastAll();
        if (choice === 'again') { finished.forEach(reviewAllAgain); await say(`Done. Your ${finished.join(' and ')} phrases will come back as review cards, a few at a time.`); continue; }
        if (choice === 'new') { await say(`Ask Claude Code for the next ${finished.join(' and ')} pack. It's written the same way and dropped into content/phrases, and your progress on this one is kept.`); continue; }
      }
      await say('Which languages are you learning?');
      const langs = await askMany(LANG_OPTS.map(l => [l, l]), 'Save languages', undefined, S.profile?.langs || []);
      setLangs(langs); pastAll(); await say(langs.length ? `A daily phrase for ${langs.join(', ')}.` : 'No languages for now.');
      continue;
    }
  }
  running = false; chatOpen = false; closeScreen();
}
document.getElementById('chatBtn')!.addEventListener('click', () => openChat());
