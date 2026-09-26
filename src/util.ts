/* Everything from feeds is untrusted: escape it before it goes into HTML */
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
export const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? esc(u) : '#');

export function ago(iso: string): string {
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

let tt: ReturnType<typeof setTimeout>;
export function toast(msg: string) {
  const t = document.getElementById('toast')!;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2000);
}

export const seedFor = (id: string) => [...id].reduce((a, ch) => a + ch.charCodeAt(0) * 7, 11);

export const ICON = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5S3.5 15.6 3.5 9.3A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.5c0 6.3-8.5 11.2-8.5 11.2z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3h12v18l-6-4.5L6 21z" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
};
