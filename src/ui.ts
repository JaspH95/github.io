/* Small shared UI helpers */
import { now } from './state';

/* Everything from feeds is untrusted: escape it before it goes into HTML */
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
export const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? esc(u) : '#');
export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
export const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export function ago(iso: string, upper = false): string {
  const m = Math.max(0, Math.round((+now() - +new Date(iso)) / 60000));
  let s: string;
  if (m < 1) s = 'just now';
  else if (m < 60) s = `${m} min ago`;
  else if (m < 60 * 24) { const h = Math.round(m / 60); s = `${h} hr ago`; }
  else { const d = Math.round(m / 1440); s = d === 1 ? '1 day ago' : `${d} days ago`; }
  return upper ? s.toUpperCase() : s;
}
/* Compact age for the coverage cards: "18 HR", "2 DAYS" */
export function age(iso: string): string {
  const m = Math.max(0, Math.round((+now() - +new Date(iso)) / 60000));
  if (m < 60) return `${Math.max(1, m)} MIN`;
  if (m < 1440) return `${Math.round(m / 60)} HR`;
  const d = Math.round(m / 1440);
  return d === 1 ? '1 DAY' : `${d} DAYS`;
}

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/* First n sentences of a paragraph */
export function sentences(s: string, n = 2): string {
  const parts = String(s || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["’”)]?(\s|$)|[^.!?]+$/g) || [];
  return parts.slice(0, n).join('').trim();
}

let tt: ReturnType<typeof setTimeout>;
export function toast(msg: string) {
  const t = document.getElementById('toast')!;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2100);
}

/* A bottom sheet of options, or any content */
const sheet = () => document.getElementById('sheet')!, sheetBg = () => document.getElementById('sheetBg')!;
export function openSheet(html: string, label = 'Options'): HTMLElement {
  const s = sheet();
  s.setAttribute('aria-label', label);
  s.innerHTML = `<div class="grab"></div>${html}`;
  s.classList.add('open'); sheetBg().classList.add('open');
  s.scrollTop = 0;
  return s;
}
export function closeSheet() { sheet().classList.remove('open'); sheetBg().classList.remove('open'); }
export function options(items: [string, string, () => void][], label = 'Options') {
  const s = openSheet(items.map(([k, l]) => `<button class="opt-row" data-k="${esc(k)}">${esc(l)}</button>`).join(''), label);
  s.querySelectorAll<HTMLButtonElement>('.opt-row').forEach(b => b.addEventListener('click', () => { closeSheet(); items.find(i => i[0] === b.dataset.k)?.[2](); }));
}

export const seedFor = (id: string) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 100000, 11);

/* Outlet badge colour: a stable colour per outlet */
const OUTLET_COLOURS: Record<string, string> = { 'BBC News': '#B80000', 'BBC Sport': '#FFD230', 'The Guardian': '#052962', 'The Verge': '#5200FF', 'Ars Technica': '#FF4E00', TechCrunch: '#0A9E01', 'MIT Technology Review': '#111111', NASA: '#0B3D91', 'Bank of England': '#2A5D3C', 'HubSpot Developers': '#FF7A59', 'HubSpot blog': '#FF7A59' };
export function outletBadge(outlet: string): { ini: string; col: string; ink: string } {
  const ini = outlet.replace(/^The /, '').split(/\s+/).filter(w => /^[A-Z0-9]/.test(w)).map(w => w[0]).join('').slice(0, 2) || outlet.slice(0, 2).toUpperCase();
  const col = OUTLET_COLOURS[outlet] || `hsl(${seedFor(outlet) % 360} 55% 38%)`;
  return { ini, col, ink: outlet === 'BBC Sport' ? '#000' : '#fff' };
}

export const ICON = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5S3.5 15.6 3.5 9.3A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.5c0 6.3-8.5 11.2-8.5 11.2z"/></svg>',
  mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
  bolt: '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M7 0L1.5 7H5l-1 5 5.5-7H6z"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  play: '<svg viewBox="0 0 12 14" fill="currentColor"><path d="M1 1.5v11a1 1 0 0 0 1.5.9l9-5.5a1 1 0 0 0 0-1.8l-9-5.5A1 1 0 0 0 1 1.5z"/></svg>',
  pause: '<svg viewBox="0 0 12 14" fill="currentColor"><rect x="1" y="1" width="3.5" height="12" rx="1"/><rect x="7.5" y="1" width="3.5" height="12" rx="1"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M3 5.5C3 4.7 3.7 4 4.5 4H11v16H4.5C3.7 20 3 19.3 3 18.5z"/><path d="M21 5.5c0-.8-.7-1.5-1.5-1.5H13v16h6.5c.8 0 1.5-.7 1.5-1.5z"/></svg>',
  edition: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5" stroke-linecap="round"/></svg>',
  lang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h9M8.5 3v2M6 5c.5 3 2.5 6 6 7.5M11 5c-.5 3-3 6.5-7 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  wave: '<svg width="20" height="14" viewBox="0 0 20 14" fill="currentColor" aria-hidden="true"><rect x="0" y="5" width="2" height="4" rx="1"/><rect x="4" y="2" width="2" height="10" rx="1"/><rect x="8" y="0" width="2" height="14" rx="1"/><rect x="12" y="3" width="2" height="8" rx="1"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
};
