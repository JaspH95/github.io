/* Onboarding and the settings chat share one screen. Both run on the phone with no AI.
   The look is the prototype's: each question types out mid-screen, earlier lines drift up and fade,
   answers are pill buttons (chosen ones in mint), and the text box sits right under the question. */
import { S, persist, load, DEFAULT_EDITIONS, DEFAULT_QUIET, now, type Profile, type PickedInterest, type Language, type Slot, type Mode } from './state';
import { INTERESTS, CATEGORIES, interestById, placeFor, regionName, TEAM_SLUGS, SPORT_FEEDS, BBC_REGIONS, WORLD_CITIES, data } from './data';
import { LANGUAGES, BSL, LEVELS, GOALS, hasPack } from './languages';
import { wait, esc, toast } from './ui';
import { preview, forget, SLOT_LABEL } from './edition';
import { close as closeStory } from './story';
import { exportData, importData, deleteEverything } from './backup';
import { feedback } from './feedback';
import { log } from './events';
import type { Occupation, OccupationsFile, TopicKey } from './types';
import { makeMatcher } from './jobmatch';
import * as cloud from './cloud';
import { suggestions, follow, markAsked } from './suggest';
import { AREAS, areaById } from './workareas';

const $ = (id: string) => document.getElementById(id)!;
const onb = () => $('onb'), lines = () => $('lines'), stream = () => $('stream'), otray = () => $('otray'), orb = () => $('orb');
let fast = false;
const toBottom = () => { stream().scrollTop = stream().scrollHeight; };

/* ---------- Keyboard: the question stays visible above it ---------- */
function setPad() { lines().style.setProperty('--pad', onb().classList.contains('kb') ? '10px' : Math.round(stream().clientHeight * 0.4) + 'px'); }
function fit() {
  const vv = window.visualViewport;
  if (vv && onb().classList.contains('open')) { onb().style.height = vv.height + 'px'; onb().style.transform = `translateY(${vv.offsetTop}px)`; }
  setPad();
}
function keepQuestion() {
  const form = lines().querySelector<HTMLElement>('.oform'); if (!form) return toBottom();
  let q = form.previousElementSibling as HTMLElement | null; while (q && !q.classList.contains('ln')) q = q.previousElementSibling as HTMLElement | null;
  const target = q ? q.offsetTop - 30 : form.offsetTop - 120;
  stream().scrollTop = Math.max(0, Math.min(target, form.offsetTop + form.offsetHeight - stream().clientHeight + 16));
}
function kbOn() { onb().classList.add('kb'); fit(); setTimeout(() => { fit(); keepQuestion(); }, 120); setTimeout(() => { fit(); keepQuestion(); }, 450); }
function kbOff() { setTimeout(() => { if (document.activeElement?.tagName !== 'INPUT' || !onb().contains(document.activeElement)) { onb().classList.remove('kb'); fit(); } }, 120); }

const IC: Record<string, string> = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/></svg>',
  job: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  time: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 5.5C3 4.7 3.7 4 4.5 4H11v16H4.5C3.7 20 3 19.3 3 18.5z"/><path d="M21 5.5c0-.8-.7-1.5-1.5-1.5H13v16h6.5c.8 0 1.5-.7 1.5-1.5z"/></svg>',
  ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5S3.5 15.6 3.5 9.3A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.5c0 6.3-8.5 11.2-8.5 11.2z"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
};

/* ---------- The chat primitives ---------- */

function pastAll() { lines().querySelectorAll('.ln:not(.past)').forEach(n => n.classList.add('past')); }
async function say(text: string, cls = '') {
  const n = document.createElement('p'); n.className = 'ln ' + cls; lines().appendChild(n);
  orb().classList.add('talk'); fast = false;
  for (let i = 1; i <= text.length; i++) { if (fast) { n.textContent = text; break; } n.textContent = text.slice(0, i); if (i % 4 === 0) toBottom(); await wait(18); }
  orb().classList.remove('talk'); toBottom(); await wait(fast ? 80 : 340);
  return n;
}
function answer(text: string) { stream().classList.remove('choosing'); const n = document.createElement('p'); n.className = 'ln ans'; n.textContent = text; lines().appendChild(n); toBottom(); }
function showQ(box: HTMLElement) {
  let q = box.previousElementSibling as HTMLElement | null; while (q && !q.classList.contains('ln')) q = q.previousElementSibling as HTMLElement | null;
  if (!q) return toBottom();
  stream().classList.add('choosing');
  const max = stream().scrollHeight - stream().clientHeight;
  stream().scrollTop = Math.min(max, Math.max(0, q.offsetTop - 64));
}
function makeForm(placeholder: string, cls = '') {
  const f = document.createElement('form'); f.className = 'oform inline ' + cls; f.noValidate = true;   // Knowfeed's own messages, not the browser's
  f.innerHTML = `<input aria-label="Your answer" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" maxlength="80"><button class="osend" aria-label="Send"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>`;
  const input = f.querySelector('input')!;
  input.placeholder = placeholder;
  input.addEventListener('focus', kbOn); input.addEventListener('blur', kbOff);
  return f;
}
function tray(label: string, disabled = false): HTMLButtonElement {
  otray().innerHTML = `<button class="glow-btn">${esc(label)}</button>`;
  const b = otray().querySelector<HTMLButtonElement>('.glow-btn')!; b.disabled = disabled; return b;
}
const clearTray = () => { otray().innerHTML = ''; };
const blurAll = () => { (document.activeElement as HTMLElement | null)?.blur?.(); onb().classList.remove('kb'); fit(); };

function askText(placeholder: string, max = 40, setup?: (i: HTMLInputElement) => void): Promise<string> {
  return new Promise(res => {
    const f = makeForm(placeholder); lines().appendChild(f); toBottom();
    const input = f.querySelector('input')!; input.maxLength = max; setup?.(input);
    f.addEventListener('submit', e => { e.preventDefault(); const secret = input.type === 'password'; const v = secret ? input.value : input.value.trim(); if (!v) return; blurAll(); f.remove(); answer(secret ? '•'.repeat(8) : v); res(v); });
    setTimeout(() => showQ(f), 30);
  });
}
function askOne(opts: [string, string, string?][]): Promise<string> {
  return new Promise(res => {
    const box = document.createElement('div'); box.className = 'olist';
    opts.forEach(([k, l, ic], i) => {
      const b = document.createElement('button'); b.className = 'po'; b.style.animationDelay = `${i * 40}ms`; b.innerHTML = `${ic ? IC[ic] || '' : ''}<span></span>`; b.querySelector('span')!.textContent = l;
      b.addEventListener('click', () => { box.remove(); answer(l); res(k); }); box.appendChild(b);
    });
    lines().appendChild(box); showQ(box);
  });
}
/* Pills to toggle, grouped under headings if given, with an optional search box that adds more */
interface ManyOpts { btn: string; none?: string; preset?: string[]; groups?: [string, [string, string][]][]; search?: { placeholder: string; find: (q: string) => Promise<[string, string][]> }; compact?: boolean; min?: number }
function askMany(opts: [string, string][], o: ManyOpts): Promise<string[]> {
  return new Promise(res => {
    const picked = new Set(o.preset || []);
    const labels = new Map<string, string>(opts);
    const box = document.createElement('div'); box.className = 'olist' + (o.compact ? ' compact' : '');
    const go = tray('');
    const update = () => {
      const n = picked.size;
      go.disabled = !n && !o.none;
      go.textContent = n ? (o.preset?.length ? o.btn : `${o.btn} (${n})`) : (o.none || o.btn);
    };
    const pill = (k: string, l: string, i: number) => {
      const b = document.createElement('button'); b.className = 'po'; b.style.animationDelay = `${Math.min(i, 20) * 25}ms`;
      b.setAttribute('aria-pressed', String(picked.has(k))); b.innerHTML = '<span></span><span class="tick"></span>'; b.querySelector('span')!.textContent = l;
      b.addEventListener('click', () => { picked.has(k) ? picked.delete(k) : picked.add(k); b.setAttribute('aria-pressed', String(picked.has(k))); update(); });
      return b;
    };
    if (o.search) {
      const f = makeForm(o.search.placeholder, 'search-add'); f.querySelector('input')!.maxLength = 60;
      const found = document.createElement('div'); found.className = 'found';
      f.addEventListener('submit', async e => {
        e.preventDefault(); const input = f.querySelector('input')!; const v = input.value.trim(); if (!v) return;
        found.innerHTML = '<p class="ln thinking">Looking…</p>';
        const hits = await o.search!.find(v).catch(() => [] as [string, string][]);
        found.innerHTML = '';
        if (!hits.length) { found.innerHTML = `<p class="ln thinking">Nothing found for “${esc(v)}”. Try another word.</p>`; return; }
        hits.forEach(([k, l], i) => { labels.set(k, l); found.appendChild(pill(k, l, i)); });
        input.value = '';
      });
      box.appendChild(f); box.appendChild(found);
    }
    let i = 0;
    if (o.groups) for (const [g, items] of o.groups) {
      const h = document.createElement('p'); h.className = 'ogroup'; h.textContent = g; box.appendChild(h);
      const row = document.createElement('div'); row.className = 'chips-row';
      items.forEach(([k, l]) => { labels.set(k, l); row.appendChild(pill(k, l, i++)); });
      box.appendChild(row);
    } else {
      const row = document.createElement('div'); row.className = o.compact ? 'chips-row' : 'olist-inner';
      opts.forEach(([k, l]) => row.appendChild(pill(k, l, i++)));
      box.appendChild(row);
    }
    lines().appendChild(box); update();
    go.addEventListener('click', () => {
      blurAll();
      const keys = [...picked]; box.remove(); clearTray();
      answer(keys.length ? keys.map(k => labels.get(k) || k).join(', ') : o.none || 'None');
      res(keys);
    });
    showQ(box);
  });
}

/* ---------- Questions ---------- */

type City = [string, string, number, number];
let cityList: City[] | null = null;
async function cities(): Promise<City[]> {
  if (cityList) return cityList;
  try { const r = await fetch('/data/cities.json'); if (r.ok) cityList = (await r.json()).cities; } catch { /* offline */ }
  return cityList || [];
}
const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '');
const COUNTRY = typeof Intl !== 'undefined' && (Intl as any).DisplayNames ? new (Intl as any).DisplayNames(['en-GB'], { type: 'region' }) : null;
const countryName = (c: string) => { try { return c === 'GB' ? 'UK' : COUNTRY?.of(c) || c; } catch { return c; } };

async function askCity(): Promise<Profile['city']> {
  const list = await cities();
  if (!list.length) {
    // No city list (offline): pick the nearest region instead
    const k = await askOne([...BBC_REGIONS.slice(0, 12).map(r => [`r:${r.id}`, r.name, 'pin'] as [string, string, string]), ...WORLD_CITIES.slice(0, 8).map(w => [`w:${w.id}`, w.name, 'globe'] as [string, string, string])]);
    const r = BBC_REGIONS.find(x => `r:${x.id}` === k), w = WORLD_CITIES.find(x => `w:${x.id}` === k);
    return r ? { name: r.name, country: 'GB', lat: r.lat, lon: r.lon, region: r.id } : { name: w!.name, country: '', lat: w!.lat, lon: w!.lon, world: w!.id };
  }
  return new Promise(res => {
    // Suggestions sit above the text box, closest match nearest to it, so the keyboard never covers them
    const f = makeForm('Start typing your city or town');
    const sug = document.createElement('div'); sug.className = 'olist sugg'; lines().appendChild(sug); lines().appendChild(f);
    const input = f.querySelector('input')!;
    const draw = () => {
      const q = fold(input.value.trim());
      sug.innerHTML = '';
      if (q.length < 2) return;
      const hits = list.filter(c => fold(c[0]).startsWith(q)).slice(0, 5);
      const more = hits.length < 5 ? list.filter(c => !hits.includes(c) && fold(c[0]).includes(q)).slice(0, 5 - hits.length) : [];
      [...hits, ...more].reverse().forEach(c => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'po'; b.innerHTML = `${IC.pin}<span></span>`;
        b.querySelector('span')!.textContent = `${c[0]}, ${countryName(c[1])}`;
        b.addEventListener('click', () => { blurAll(); f.remove(); sug.remove(); answer(`${c[0]}, ${countryName(c[1])}`); res(placeFor(c[0], c[1], c[2], c[3])); });
        sug.appendChild(b);
      });
      if (!hits.length && !more.length) sug.innerHTML = '<p class="ln thinking">No match yet. Try the nearest big town.</p>';
      keepQuestion();
    };
    input.addEventListener('input', draw);
    f.addEventListener('submit', e => { e.preventDefault(); ([...sug.querySelectorAll('.po')].pop() as HTMLButtonElement | undefined)?.click(); });
    setTimeout(() => showQ(f), 30);
  });
}

let occ: OccupationsFile | null = null;
async function occupations(): Promise<OccupationsFile | null> {
  if (occ) return occ;
  try { const r = await fetch('/data/esco/occupations.json'); if (r.ok) occ = await r.json(); } catch { /* offline */ }
  return occ;
}

let matcher: ReturnType<typeof makeMatcher> | null = null;
async function skillsOf(occs: Occupation[]): Promise<[string, string][]> {
  const lists = await Promise.all(occs.map(async o => {
    try { const r = await fetch(`/data/esco/skills-${o.g.slice(0, 2) || 'xx'}.json`); if (r.ok) { const d = await r.json(); const x = d[o.u]; if (x) return [...x.e, ...x.o] as [string, string][]; } } catch { /* offline */ }
    return [] as [string, string][];
  }));
  // Take turns from each occupation so one doesn't crowd out the others
  const out: [string, string][] = [];
  for (let i = 0; out.length < 12 && lists.some(l => l[i]); i++) for (const l of lists) if (l[i] && !out.some(s => s[0] === l[i][0]) && out.length < 12) out.push(l[i]);
  return out;
}

/* Work: areas first (always something that fits), then the job title or a description, with as many tries as it takes */
async function askJob(preset?: Profile['job']): Promise<Pick<Profile, 'job' | 'skills'>> {
  await say('Which areas do you work in? Pick one or two.');
  const areaIds = await askMany(AREAS.map(a => [a.id, a.label]), { btn: 'Continue', none: 'Not working right now', preset: preset?.areas, compact: true });
  if (!areaIds.length) { pastAll(); return { job: undefined, skills: [] }; }
  const areas = areaIds.map(id => areaById.get(id)!).filter(Boolean);
  const boost = areas.flatMap(a => a.g);
  pastAll(); await say("And your job title? If it's an unusual one, just describe what you do.");
  let raw = await askText('Job title, or what you do day to day', 120);
  const file = await occupations();
  if (!file) { pastAll(); return { job: { title: raw, raw, areas: areaIds }, skills: [] }; }
  matcher ||= makeMatcher(file.occupations);
  let pick: Occupation | undefined;
  for (let tries = 1; ; tries++) {
    const hits = matcher(raw, 6, boost);
    pastAll();
    if (!hits.length) { await say("I couldn't find a match for that."); }
    else await say('Which of these is closest?');
    const k = await askOne([
      ...hits.map(o => [o.u, cap(o.t), 'job'] as [string, string, string]),
      ...(tries < 4 ? [['__retry', hits.length ? 'None of these. Let me describe it' : 'Try describing it', 'dots'] as [string, string, string]] : []),
      ['__area', `Skip. Just use ${areas.length > 1 ? 'my areas' : areas[0].label.toLowerCase()}`, 'spark'],
    ]);
    pick = hits.find(o => o.u === k);
    if (k !== '__retry') break;
    pastAll(); await say('Try it another way. What do you spend most of your day doing?');
    raw = await askText('For example: I plan email campaigns for a charity', 120);
  }
  let job: Profile['job'], skills: [string, string][];
  if (pick) {
    job = { uri: pick.u, title: cap(pick.t), raw, group: pick.g, areas: areaIds };
    skills = await skillsOf([pick]);
  } else {
    // No exact job: the skills of a few typical jobs in their areas stand in
    const byTitle = new Map(file.occupations.map(o => [o.t.toLowerCase(), o]));
    const stand = areas.flatMap(a => a.jobs.slice(0, areas.length > 1 ? 1 : 3)).map(t => byTitle.get(t.toLowerCase())).filter(Boolean) as Occupation[];
    job = { title: raw, raw, group: stand[0]?.g, areas: areaIds };
    skills = await skillsOf(stand);
  }
  if (!skills.length) return { job, skills: [] };
  pastAll();
  await say('Which of these do you want to get better at?');
  const chosen = await askMany(skills.map(([id, l]) => [id, cap(l)]), { btn: 'Continue', none: 'None for now', compact: true });
  return { job, skills: chosen.map(id => ({ id, label: skills.find(s => s[0] === id)![1], source: 'job' as const })) };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* Interest search: Guardian tags and Wikipedia, through /api/interest-search */
const searched = new Map<string, PickedInterest>();
async function findInterests(q: string): Promise<[string, string][]> {
  const own = INTERESTS.filter(i => fold(i.label).includes(fold(q))).map(i => [i.id, i.label] as [string, string]);
  let remote: [string, string][] = [];
  try {
    const r = await fetch(`/api/interest-search?q=${encodeURIComponent(q)}`);
    if (r.ok) {
      const d = await r.json();
      remote = (d.results || []).slice(0, 6).map((x: any) => {
        const id = `q:${x.label}`;
        searched.set(id, { id, label: x.label, cat: catFor(x.section), mode: 'both', ...(x.guardian ? { guardian: x.guardian } : {}), ...(x.wiki ? { wiki: x.wiki } : {}) });
        return [id, x.desc ? `${x.label} · ${x.desc}` : x.label] as [string, string];
      });
    }
  } catch { /* offline */ }
  if (!remote.length) { const id = `q:${q}`; searched.set(id, { id, label: q, cat: 'news', mode: 'both', wiki: q }); remote = [[id, q]]; }
  return [...own, ...remote].slice(0, 8);
}
function catFor(section?: string): TopicKey {
  const s = (section || '').toLowerCase();
  if (/tech|games/.test(s)) return 'tech';
  if (/science|environment/.test(s)) return 'science';
  if (/business|money/.test(s)) return 'money';
  if (/sport|football/.test(s)) return 'sport';
  if (/culture|film|music|books|art|stage|tv|food|travel|fashion/.test(s)) return 'culture';
  if (/life|society|health/.test(s)) return 'life';
  return 'news';
}
const toPicked = (id: string): PickedInterest | null => {
  const i = interestById.get(id); if (i) return { id, label: i.label, cat: i.cat, mode: 'both' };
  return searched.get(id) || S.profile?.interests.find(x => x.id === id) || null;
};

/* Two separate questions: what to follow in the news, then what to learn about. Both can search for anything.
   A topic picked in both is "both"; the edition uses news picks for stories and learning picks for learning cards. */
function askTopics(preset: PickedInterest[], placeholder: string): Promise<string[]> {
  // Sport has its own question, so it isn't repeated here
  const groups: [string, [string, string][]][] = Object.entries(CATEGORIES).filter(([c]) => c !== 'sport').map(([c, label]) => [label, INTERESTS.filter(i => i.cat === c).map(i => [i.id, i.label] as [string, string])]);
  const extra = preset.filter(p => p.id.startsWith('q:'));
  if (extra.length) groups.unshift(['Found by search', extra.map(p => [p.id, p.label])]);
  return askMany([], { btn: 'Continue', none: 'Skip for now', groups, preset: preset.filter(p => !isSport(p)).map(p => p.id), search: { placeholder, find: findInterests } });
}
async function askInterests(preset: PickedInterest[] = []): Promise<PickedInterest[]> {
  const first = !preset.length;
  await say(first ? "First, the news. What do you want to keep up with? Pick as many as you like, or type anything that's missing." : 'What do you want to follow in the news?');
  const news = await askTopics(preset.filter(p => p.mode !== 'learn'), 'Type anything else, like rewilding');
  pastAll();
  await say(first ? 'Now learning. What would you like to know more about? It can be different from your news.' : 'And what would you like to learn about?');
  const learn = await askTopics(preset.filter(p => p.mode !== 'news'), 'Type anything, like Roman history');
  const out: PickedInterest[] = [];
  for (const id of [...new Set([...news, ...learn])]) {
    const p = toPicked(id); if (!p) continue;
    out.push({ ...p, mode: news.includes(id) && learn.includes(id) ? 'both' : news.includes(id) ? 'news' : 'learn' });
  }
  return out;
}
const isSport = (p: PickedInterest) => interestById.get(p.id)?.cat === 'sport';
/* The sports you follow become news interests too, so their big stories can reach the edition */
function withSports(list: PickedInterest[], sports: string[]): PickedInterest[] {
  const keep = list.filter(p => !isSport(p));
  const add = INTERESTS.filter(i => i.cat === 'sport' && i.sport && sports.includes(i.sport)).map(i => ({ id: i.id, label: i.label, cat: i.cat, mode: 'news' as Mode }));
  return [...keep, ...add];
}

async function askLanguages(preset: Language[] = []): Promise<Language[]> {
  const names = [...LANGUAGES.map(l => l[0]), BSL];
  const picked = await askMany(names.map(n => [n, n]), { btn: 'Continue', none: 'Not right now', preset: preset.map(l => l.name), compact: true, search: { placeholder: 'Search languages', find: async q => names.filter(n => fold(n).includes(fold(q))).map(n => [n, n]) } });
  const out: Language[] = [];
  for (const name of picked) {
    const prev = preset.find(l => l.name === name);
    if (name === BSL) { out.push(prev || { name, level: 'new', goal: 'fun' }); continue; }
    if (prev) { out.push(prev); continue; }
    pastAll(); await say(`How's your ${name}?`);
    const level = await askOne(LEVELS.map(([k, l]) => [k, l]));
    pastAll(); await say(`And what's it for?`);
    const goal = await askOne(GOALS.map(([k, l]) => [k, l]));
    out.push({ name, level: level as Language['level'], goal: goal as Language['goal'] });
  }
  return out;
}

function askTeams(preset: string[] = []): Promise<string[]> {
  const clubs = Object.keys(TEAM_SLUGS);
  return askMany([...clubs, ...preset.filter(t => !clubs.includes(t))].map(c => [c, c]), {
    btn: 'Follow', none: 'No particular team', preset, compact: true,
    search: { placeholder: 'Type another team', find: async q => [[q.slice(0, 40), q.slice(0, 40)]] },
  });
}

function askEditions(p: Pick<Profile, 'editions' | 'quiet'>): Promise<Pick<Profile, 'editions' | 'quiet'>> {
  return new Promise(res => {
    const ed = structuredClone(p.editions);
    const box = document.createElement('div'); box.className = 'eds';
    box.innerHTML = (['morning', 'midday', 'evening'] as Slot[]).map(s => `<div class="erow2"><button class="po small" data-s="${s}" aria-pressed="${ed[s].on}"><span>${SLOT_LABEL[s].replace(' edition', '')}</span><span class="tick"></span></button><input type="time" data-t="${s}" value="${ed[s].time}" aria-label="${SLOT_LABEL[s]} time"></div>`).join('')
      + `<p class="ln small">Quiet hours: nothing arrives on weekdays between 09:00 and 12:00, or 13:30 and 17:30. Lunchtime is fine.</p>`;
    box.querySelectorAll<HTMLButtonElement>('[data-s]').forEach(b => b.addEventListener('click', () => { const s = b.dataset.s as Slot; ed[s].on = !ed[s].on; b.setAttribute('aria-pressed', String(ed[s].on)); go.disabled = !Object.values(ed).some(x => x.on); }));
    box.querySelectorAll<HTMLInputElement>('[data-t]').forEach(i => i.addEventListener('change', () => { if (/^\d\d:\d\d$/.test(i.value)) ed[i.dataset.t as Slot].time = i.value; }));
    lines().appendChild(box);
    const go = tray('Continue');
    go.addEventListener('click', () => {
      box.remove(); clearTray();
      const on = (Object.entries(ed) as [Slot, { on: boolean; time: string }][]).filter(([, v]) => v.on);
      answer(on.map(([s, v]) => `${SLOT_LABEL[s].replace(' edition', '')} ${v.time}`).join(', '));
      res({ editions: ed, quiet: p.quiet });
    });
    showQ(box);
  });
}

/* ---------- Account: email and password (or an emailed code, once Supabase has its own email sender) ---------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const emailInput = (i: HTMLInputElement) => { i.type = 'email'; i.inputMode = 'email'; i.autocapitalize = 'off'; i.autocomplete = 'username'; i.spellcheck = false; };
const codeInput = (i: HTMLInputElement) => { i.inputMode = 'numeric'; i.autocomplete = 'one-time-code'; i.pattern = '[0-9]*'; };
/* A hidden username next to the password lets iPhone offer a strong password and save both to Passwords */
const passwordInput = (email: string, isNew: boolean) => (i: HTMLInputElement) => {
  i.type = 'password'; i.autocapitalize = 'off'; i.spellcheck = false; i.autocomplete = isNew ? 'new-password' : 'current-password';
  const u = document.createElement('input'); u.type = 'email'; u.autocomplete = 'username'; u.value = email; u.className = 'sr'; u.tabIndex = -1; u.setAttribute('aria-hidden', 'true');
  i.before(u);
};

async function askEmail(): Promise<string> {
  for (;;) {
    const email = (await askText('you@example.com', 120, emailInput)).trim().toLowerCase();
    if (EMAIL.test(email)) return email;
    pastAll(); await say("That doesn't look like an email address. Try again?");
  }
}

/* Returns true once signed in, false if they chose to skip */
async function accountFlow(mode: 'existing' | 'new'): Promise<boolean> {
  if (cloud.emailCodes) return codeFlow();
  await say(mode === 'new' ? "What's your email? It's only used to sign you in." : "What's the email for your Knowfeed account?");
  let email = await askEmail();
  for (;;) {
    pastAll();
    await say(mode === 'new' ? 'Now choose a password, at least 8 characters.' : 'And your password?');
    const pw = await askText('Password', 72, passwordInput(email, mode === 'new'));
    pastAll();
    if (mode === 'new') {
      if (pw.length < 8) { await say("That's a bit short. Use at least 8 characters."); continue; }
      await say('Setting up your account…');
      const r = await cloud.signUp(email, pw);
      if (r.ok) return true;
      pastAll(); await say(r.exists ? "There's already an account with that email. Is it yours?" : r.msg);
      const c = await askOne(r.exists ? [['in', 'Yes, sign me in', 'heart'], ['email', 'Use a different email', 'dots'], ['skip', 'Skip for now', 'back']] : [['again', 'Try again', 'time'], ['skip', 'Skip for now', 'back']]);
      pastAll();
      if (c === 'skip') return false;
      if (c === 'in') mode = 'existing';
      if (c === 'email') { await say("What's the email?"); email = await askEmail(); }
      continue;
    }
    await say('Signing in…');
    const err = await cloud.signInPassword(email, pw);
    if (!err) return true;
    pastAll(); await say(err);
    const c = await askOne([['again', 'Try the password again', 'time'], ['new', 'Make a new account with this email', 'spark'], ['email', 'Use a different email', 'dots'], ['skip', 'Skip for now', 'back']]);
    pastAll();
    if (c === 'skip') return false;
    if (c === 'new') mode = 'new';
    if (c === 'email') { await say("What's the email?"); email = await askEmail(); }
  }
}

async function codeFlow(): Promise<boolean> {
  await say("What's your email? I'll send you a code. No password needed.");
  const email = await askEmail();
  for (;;) {
    pastAll();
    const err = await cloud.sendCode(email);
    if (err) {
      await say(`I couldn't send the code. ${err}`);
      const c = await askOne([['again', 'Try again', 'time'], ['skip', 'Skip for now', 'dots']]);
      if (c === 'skip') return false;
      continue;
    }
    await say(`I've sent a code to ${email}. Type it here. It can take a minute, so check your junk folder too.`);
    for (;;) {
      const code = (await askText('The code from the email', 10, codeInput)).replace(/\D/g, '');
      const bad = code.length < 6 ? 'Codes are 6 digits or more.' : await cloud.verifyCode(email, code);
      if (!bad) { pastAll(); return true; }
      pastAll(); await say(bad);
      const c = await askOne([['retry', 'Type the code again', 'time'], ['resend', 'Send a new code', 'spark'], ['skip', 'Skip for now', 'dots']]);
      pastAll();
      if (c === 'skip') return false;
      if (c === 'resend') break;
    }
  }
}

/* ---------- Opening and closing the screen ---------- */

function openScreen(mode: 'setup' | 'chat') {
  closeStory(); lines().innerHTML = ''; clearTray();
  onb().classList.toggle('chat', mode === 'chat');
  onb().classList.remove('fade', 'kb'); onb().classList.add('open'); fit(); setPad();
  document.body.classList.add('onb-open');
}
let onDone: () => void = () => {};
export const onChatClosed = (fn: () => void) => { onDone = fn; };
async function closeScreen() {
  blurAll();
  onb().classList.add('fade');
  await wait(450);
  onb().classList.remove('open', 'fade', 'chat', 'kb'); onb().style.transform = ''; onb().style.height = '';
  document.body.classList.remove('onb-open');
  running = false; chatOpen = false;
  onDone();
}

let running = false;
const standalone = () => (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches;

export async function startOnboarding() {
  if (running) return; running = true;
  openScreen('setup');
  await wait(400);
  await say("Hi. I'm going to ask a few quick questions, then build your first edition. It takes about two minutes.");
  if (cloud.cloudOn && !cloud.signedIn()) {
    await say('New here, or have you set up Knowfeed before?');
    const k = await askOne([['new', "I'm new", 'spark'], ['back', 'Sign in and bring back my answers', 'heart']]);
    pastAll();
    if (k === 'back' && await accountFlow('existing')) {
      await say('Signed in. Looking for your answers…');
      const got = await cloud.pull().catch(() => false);
      if (got && load('profile', null)) { await say('Found them. Opening your feed…'); await wait(600); location.reload(); return; }
      pastAll(); await say("I couldn't find any answers for that email, so let's set you up. They'll be saved to your account as we go.");
    }
  }
  await say('First, what should I call you?');
  const name = await askText('Your first name', 30);
  pastAll(); await say(`Good to meet you, ${name}.`);
  await say('Where do you live? Your city or town is enough.');
  const city = await askCity();
  pastAll(); await say(city?.region ? `${city.name}. I'll bring you local news from BBC ${regionName(city)}.` : city?.world ? `${city.name}. I'll keep you across the big stories there.` : `${city?.name}. I'll look for news about ${city?.name} from the Guardian.`);
  await say('Now, your work.');
  const work = await askJob();
  pastAll(); await say(work.skills.length ? "Thanks. I'll bring you a skill of the day and news from your field." : 'Got it.');
  const interests = await askInterests();
  pastAll(); await say(interests.length > 5 ? 'A good mix. Serious, but never dull.' : interests.length ? 'Focused. I like it.' : "No problem. I'll start broad and learn from what you like.");
  await say('Want to learn a language?');
  const languages = await askLanguages();
  pastAll(); await say(languages.length ? "A phrase a day adds up faster than you'd think." : 'No problem. You can add one later.');
  await say('Any sports or teams to keep an eye on?');
  const sports = await askMany(Object.keys(SPORT_FEEDS).map(s => [s, s]), { btn: 'Continue', none: 'Not really', compact: true });
  let teams: string[] = [];
  if (sports.includes('Football')) { pastAll(); await say('Which teams? Pick from these or type your own.'); teams = await askTeams(); }
  pastAll(); await say(teams.length ? `${teams[0]}. You'll get one sports page per edition, and a live score while they're playing.` : sports.length ? "You'll get one sports page per edition, like a newspaper." : 'No sport, then.');
  await say("When do you like to catch up? I'll put together an edition for each time. Each one ends, so you know when you're done.");
  const eds = await askEditions({ editions: structuredClone(DEFAULT_EDITIONS), quiet: structuredClone(DEFAULT_QUIET) });
  pastAll(); await say("Anything you'd rather not see?");
  const chosen = new Set(interests.map(i => i.id));
  const avoid = await askMany(INTERESTS.filter(i => !chosen.has(i.id) && i.cat !== 'sport').map(i => [i.id, i.label]), { btn: 'Hide these', none: "Nothing, I'm open", compact: true });
  pastAll(); await say(avoid.length ? "Done. You won't see those." : 'Open-minded. Noted.');

  S.profile = { name, city, ...work, interests: withSports(interests, sports), languages, sports, teams, avoid, ...eds, created: now().toISOString() };
  S.weights = {};
  persist.profile(); persist.weights();
  forget();
  log('onboarding_finish', { interests: interests.length, languages: languages.length });

  await say('Building your first edition…');
  const bar = document.createElement('div'); bar.className = 'progress'; bar.innerHTML = '<i></i>'; lines().appendChild(bar); toBottom();
  requestAnimationFrame(() => requestAnimationFrame(() => ((bar.firstChild as HTMLElement).style.width = '100%')));
  await wait(1500);
  const heads = data.news ? preview(S.profile) : [];
  pastAll();
  await say(`Here's your Knowfeed, ${name}.`, 'big');
  if (heads.length) {
    const box = document.createElement('div'); box.className = 'previewbox';
    box.innerHTML = `<p class="ogroup">First up</p>${heads.map(h => `<p class="prev">${esc(h)}</p>`).join('')}`;
    lines().appendChild(box); toBottom();
  }
  if (cloud.cloudOn && !cloud.signedIn()) {
    await say("Want me to keep your answers safe? With an account (just an email and a password) they come back if you add Knowfeed to your Home Screen or change phones.", 'small');
    const k = await askOne([['yes', 'Make an account', 'heart'], ['have', 'I already have one', 'shield'], ['no', 'Not now', 'dots']]);
    pastAll();
    if (k !== 'no' && await accountFlow(k === 'yes' ? 'new' : 'existing')) { await cloud.push().catch(() => {}); await say('Saved to your account.', 'small'); }
  } else if (cloud.signedIn()) cloud.push().catch(() => {});
  if (!standalone()) await say(cloud.signedIn() ? 'Tip: add Knowfeed to your Home Screen (in Safari, tap Share, then "Add to Home Screen"), open it from there and sign in with the same email and password.' : 'Tip: add Knowfeed to your Home Screen. In Safari, tap Share, then "Add to Home Screen".', 'small');
  await say("Double tap anything you like. I learn from your likes, show you more of what you enjoy and suggest topics to follow.", 'small');
  await say('You can change anything later: tap Chat at the bottom, or Profile.', 'small');
  const go = tray('Show my feed');
  go.addEventListener('click', () => { clearTray(); closeScreen(); });
}

/* ---------- The settings chat ---------- */

let chatOpen = false;
type Section = 'interests' | 'city' | 'skills' | 'languages' | 'sport' | 'editions' | 'avoid' | 'wellbeing' | 'data' | 'suggest' | 'feedback' | 'account' | 'voice';

export async function openChat(jump?: Section) {
  if (running || !S.profile) return;
  running = true; chatOpen = true; openScreen('chat');
  await wait(250);
  const p = S.profile;
  if (jump) { await section(jump); if (!chatOpen) return; }
  else await say(`Hi ${p.name}. What would you like to change?`);
  while (chatOpen) {
    const pick = await askOne([
      ['suggest', 'Suggest something new', 'spark'], ['interests', 'My interests', 'heart'], ['city', 'My city', 'pin'], ['skills', 'My work and skills', 'job'],
      ['languages', 'Languages', 'globe'], ['sport', 'Sports and teams', 'ball'], ['editions', 'Editions and times', 'time'], ['avoid', 'Topics to avoid', 'shield'],
      ['wellbeing', 'Reading goal and limit', 'book'], ['voice', 'Listening voice', 'spark'], ['feedback', 'Feedback and notes', 'flag'], ...(cloud.cloudOn ? [['account', cloud.signedIn() ? 'Account and sync' : 'Sign in to save my answers', 'shield'] as [string, string, string]] : []), ['data', 'Your data', 'dots'], ['done', 'Back to my feed', 'back'],
    ]);
    if (!chatOpen) break;
    pastAll();
    if (pick === 'done') break;
    await section(pick as Section);
  }
  if (chatOpen) closeScreen();
}

async function section(k: Section) {
  const p = S.profile!;
  const saveP = (msg: string) => { persist.profile(); forget(); return say(msg); };
  switch (k) {
    case 'suggest': {
      const list = suggestions(6);
      if (!list.length) { await say("You're already following most of what's around today. Keep double tapping things you like and I'll keep tuning."); return; }
      const fromLikes = S.liked.size > 0;
      await say(fromLikes ? "From what you've liked, you might want to follow these. Pick any." : "Double tap stories you like and I'll learn what to suggest. For now, these have the most going on today:");
      const picked = await askMany(list.map(x => [x.key, x.kind === 'entity' && x.desc ? `${x.label} · ${x.desc}` : x.label]), { btn: 'Follow', none: 'Not now', compact: true });
      pastAll();
      list.forEach(x => (picked.includes(x.key) ? follow(x) : markAsked(x.key)));
      if (picked.length) { forget(); await say(`Following ${picked.length === 1 ? list.find(x => x.key === picked[0])!.label : `${picked.length} new things`}. You'll see more from your next edition.`); }
      else await say('No problem.');
      return;
    }
    case 'interests': {
      const list = await askInterests(p.interests);
      p.interests = withSports(list, p.sports); p.avoid = p.avoid.filter(a => !list.some(i => i.id === a));
      pastAll(); await saveP(list.length ? `Done. ${list.length} interest${list.length > 1 ? 's' : ''}. Your next edition uses them.` : 'Done. I\'ll keep things broad.');
      return;
    }
    case 'city': { await say('Where do you live now?'); const c = await askCity(); p.city = c; pastAll(); await saveP(`${c?.name} it is.`); return; }
    case 'skills': {
      if (p.job) await say(`You told me: ${p.job.title}.`);
      const w = await askJob(p.job); p.job = w.job; p.skills = [...w.skills, ...p.skills.filter(s => s.source === 'chosen' && !w.skills.some(x => x.id === s.id))];
      pastAll(); await saveP(p.skills.length ? `Saved. ${p.skills.length} skill${p.skills.length > 1 ? 's' : ''} for your skill of the day.` : 'Saved.');
      return;
    }
    case 'languages': {
      const { progress } = await import('./srs');
      const { PACKS } = await import('./languages');
      const finished = p.languages.filter(l => hasPack(l.name) && progress(l.name, PACKS[l.name]).finished);
      if (finished.length) {
        await say(`You've met every phrase in your ${finished.map(l => l.name).join(' and ')} pack. What next?`);
        const c = await askOne([['again', 'Pack finished: review everything again', 'time'], ['new', 'Ask for a new pack', 'spark'], ['change', 'Change my languages', 'globe']]);
        pastAll();
        if (c === 'again') { const s = await import('./srs'); finished.forEach(l => s.reviewAllAgain(l.name, PACKS[l.name])); await say('Done. Your phrases will come back as reviews, a few at a time.'); return; }
        if (c === 'new') { await say("Noted. New packs are written the same way and added to the app; your progress on this one is kept."); feedbackNote(`New phrase pack requested: ${finished.map(l => l.name).join(', ')}`); return; }
      }
      await say('Which languages are you learning?');
      p.languages = await askLanguages(p.languages);
      pastAll(); await saveP(p.languages.length ? `Saved: ${p.languages.map(l => l.name).join(', ')}.` : 'No languages for now.');
      return;
    }
    case 'sport': {
      await say('Which sports do you follow?');
      p.sports = await askMany(Object.keys(SPORT_FEEDS).map(s => [s, s]), { btn: 'Save', none: 'None', preset: p.sports, compact: true });
      if (p.sports.includes('Football')) { pastAll(); await say('Which teams?'); p.teams = await askTeams(p.teams); } else p.teams = [];
      p.interests = withSports(p.interests, p.sports);
      pastAll(); await saveP(p.sports.length ? 'Saved. Your sports page updates from the next edition.' : "Sport's out.");
      return;
    }
    case 'editions': {
      await say('When would you like your editions?');
      const e = await askEditions(p); p.editions = e.editions;
      pastAll(); await saveP('Saved.');
      return;
    }
    case 'avoid': {
      await say("What would you rather not see?");
      const mine = new Set(p.interests.map(i => i.id));
      p.avoid = await askMany(INTERESTS.filter(i => !mine.has(i.id) && i.cat !== 'sport').map(i => [i.id, i.label]), { btn: 'Save', none: "Nothing, I'm open", preset: p.avoid, compact: true });
      pastAll(); await saveP(p.avoid.length ? `Hidden: ${p.avoid.map(a => interestById.get(a)?.label).join(', ')}.` : 'Nothing hidden.');
      return;
    }
    case 'wellbeing': {
      await say('A daily reading goal? It shows your progress on the done screen.');
      const g = await askOne([['0', 'No goal', 'dots'], ['10', '10 minutes', 'time'], ['20', '20 minutes', 'time'], ['30', '30 minutes', 'time']]);
      p.goalMin = +g || undefined;
      pastAll(); await say('And a daily limit? When you reach it, Knowfeed suggests a break. Off by default.');
      const l = await askOne([['0', 'No limit', 'dots'], ['30', '30 minutes', 'time'], ['45', '45 minutes', 'time'], ['60', '1 hour', 'time']]);
      p.limitMin = +l || undefined;
      pastAll(); await saveP('Saved. After 45 minutes of continuous reading I\'ll also check in, gently.');
      return;
    }
    case 'feedback': {
      const n = S.feedback.length;
      await say(n ? `You've left ${n} note${n > 1 ? 's' : ''}. They're kept on this phone for now.` : 'Tell me what you think. Notes are kept on this phone for now.');
      const c = await askOne([['new', 'Write a note', 'flag'], ...(n ? [['see', 'See my notes', 'book'] as [string, string, string]] : []), ['back', 'Back', 'back']]);
      pastAll();
      if (c === 'new') { closeScreen(); setTimeout(() => feedback(), 500); }
      if (c === 'see') { const box = document.createElement('div'); box.className = 'previewbox'; box.innerHTML = S.feedback.slice(0, 20).map(f => `<p class="prev"><b>${esc(new Date(f.at).toLocaleDateString('en-GB'))}</b> ${f.title ? `(${esc(f.title)}) ` : ''}${esc(f.text)}</p>`).join(''); lines().appendChild(box); toBottom(); }
      return;
    }
    case 'voice': {
      const { voicesFor, setVoice, sample, currentVoice, goodVoice } = await import('./audio');
      const vs = voicesFor('en-GB').slice(0, 6);
      if (!vs.length) { await say("This phone doesn't have an English voice I can use."); return; }
      await say(goodVoice() ? `I'm reading with ${currentVoice()!.name}. Tap a voice to hear it.` : "The voices that come with an iPhone sound robotic, but it has natural ones you can download free: Settings → Accessibility → Spoken Content → Voices → English, then pick one marked Enhanced or Premium. After that, choose it here.");
      for (;;) {
        const k = await askOne([...vs.map(v => [v.voiceURI, `${v.name}${v.voiceURI === currentVoice()?.voiceURI ? ' (in use)' : ''}`, 'spark'] as [string, string, string]), ['done', 'Done', 'back']]);
        pastAll();
        if (k === 'done') return;
        const v = vs.find(x => x.voiceURI === k)!; setVoice(k); sample(v);
        await say(`Now using ${v.name}.`);
      }
    }
    case 'account': {
      const u = cloud.signedIn();
      if (!u) {
        let ok = false;
        if (cloud.emailCodes) ok = await codeFlow();
        else {
          await say('Do you already have a Knowfeed account?');
          const h = await askOne([['existing', 'Yes, sign me in', 'heart'], ['new', 'No, make one', 'spark'], ['back', 'Back', 'back']]);
          pastAll();
          if (h === 'back') return;
          ok = await accountFlow(h as 'existing' | 'new');
        }
        if (!ok) { await say('No problem. Everything stays on this phone.'); return; }
        await say('Signed in. Syncing…');
        const got = await cloud.pull().catch(() => false);
        if (got) { await say('Your account had newer answers. Reloading with them…'); await wait(700); location.reload(); return; }
        await say('Done. Your answers, saves and progress are now kept with your account.');
        return;
      }
      const t = cloud.lastSynced();
      await say(`Signed in as ${u.email}.${t ? ` Last synced ${new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.` : ''}`);
      const c = await askOne([['sync', 'Sync now', 'time'], ['out', 'Sign out', 'back'], ['back', 'Back', 'dots']]);
      pastAll();
      if (c === 'sync') { const got = await cloud.pull().catch(() => null); if (got === null) await say("Couldn't reach Knowfeed just now. It'll try again later."); else if (got) { await say('Got newer answers from your account. Reloading…'); await wait(700); location.reload(); } else await say('All up to date.'); }
      if (c === 'out') { await cloud.signOut(); await say('Signed out. Everything is still on this phone.'); }
      return;
    }
    case 'data': {
      await say(cloud.signedIn() ? 'Your data is on this phone and in your Knowfeed account. What would you like to do?' : 'Everything personal is stored on this phone. What would you like to do?');
      const c = await askOne([['export', 'Back up to a file', 'book'], ['import', 'Restore from a file', 'time'], ['delete', 'Delete everything', 'shield'], ['back', 'Back', 'back']]);
      pastAll();
      if (c === 'export') { await exportData(); await say('Saved a backup file.'); }
      if (c === 'import') { importData(); await say('Pick your backup file.'); }
      if (c === 'delete') {
        await say(cloud.signedIn() ? 'This deletes your Knowfeed account and removes your settings, likes, saves and progress from this phone. Are you sure?' : 'This removes your settings, likes, saves and progress from this phone. Are you sure?');
        const y = await askOne([['no', 'No, keep everything', 'back'], ['yes', 'Yes, delete everything', 'shield']]);
        if (y === 'yes') {
          if (cloud.signedIn() && !(await cloud.deleteAccount())) { pastAll(); await say("I couldn't delete your account just now, so nothing's been deleted. Try again when you have signal."); return; }
          deleteEverything(); return;
        }
        pastAll(); await say('Nothing deleted.');
      }
      return;
    }
  }
}

function feedbackNote(text: string) { S.feedback.unshift({ at: now().toISOString(), text }); persist.feedback(); toast('Noted'); }

export function initChat() {
  stream().addEventListener('click', e => { if (!(e.target as HTMLElement).closest('button,input')) fast = true; });
  if (window.visualViewport) { visualViewport!.addEventListener('resize', () => { fit(); if (onb().classList.contains('kb')) keepQuestion(); }); visualViewport!.addEventListener('scroll', fit); }
  window.addEventListener('resize', () => { if (onb().classList.contains('open')) setPad(); });
  $('doneBtn').addEventListener('click', () => { if (chatOpen) closeScreen(); });
  // The Chat tab opens this screen
  document.querySelector('.tab[data-chat]')?.addEventListener('click', () => openChat());
}
