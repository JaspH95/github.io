/* About, Privacy, Terms, Cookies and Refunds, shown inside the app (over whatever you were on) with a back button,
   instead of opening the browser. The pages themselves stay plain HTML in public/ for anyone visiting them directly. */
import { esc, ICON } from './ui';

export const DOCS: Record<string, string> = {
  about: 'About Knowfeed', privacy: 'Privacy Policy', terms: 'Terms of Service', cookies: 'Cookie Policy', refunds: 'Refund Policy',
};
const isDoc = (path: string) => /^\/(about|privacy|terms|cookies|refunds)(\.html)?$/.test(path);

let el: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;
const stack: string[] = [];

function view(): HTMLElement {
  if (el) return el;
  el = document.createElement('section');
  el.className = 'docview'; el.id = 'docview';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Document');
  el.innerHTML = `<header class="dochead"><button class="docback" aria-label="Back">${ICON.back}<span>Back</span></button><span class="doct"></span></header><div class="docbody" tabindex="-1"></div>`;
  el.querySelector('.docback')!.addEventListener('click', back);
  // Links to the other legal pages open here too; everything else opens as normal
  el.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const u = new URL(a.href, location.href);
    if (u.origin === location.origin && isDoc(u.pathname)) { e.preventDefault(); openDoc(u.pathname.replace(/^\/|\.html$/g, ''), true); }
    else if (u.origin === location.origin && (u.pathname === '/' || u.pathname === '/index.html')) { e.preventDefault(); closeDoc(); }
  });
  document.body.appendChild(el);
  return el;
}

export async function openDoc(name: string, push = false) {
  if (!DOCS[name]) return;
  const v = view();
  if (!v.classList.contains('open')) { returnFocus = document.activeElement as HTMLElement | null; stack.length = 0; }
  if (push || !stack.length) stack.push(name); else stack[stack.length - 1] = name;
  v.querySelector('.doct')!.textContent = DOCS[name];
  const body = v.querySelector<HTMLElement>('.docbody')!;
  body.innerHTML = '<div class="skel"></div><div class="skel w80"></div><div class="skel w60"></div>';
  v.classList.add('open');
  v.querySelector<HTMLElement>('.docback')!.focus({ preventScroll: true });
  try {
    const r = await fetch(`/${name}.html`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const main = doc.querySelector('main');
    if (!main) throw new Error('no content');
    // The page's own markup, written by us; scripts can't run from innerHTML
    body.innerHTML = main.innerHTML;
    body.scrollTop = 0;
  } catch {
    body.innerHTML = `<p class="note">Couldn't load the ${esc(DOCS[name])} just now${navigator.onLine ? '' : ' (you\'re offline)'}. You can also read it at <a href="/${name}" target="_blank" rel="noopener">knowfeed-nine.vercel.app/${name}</a>.</p>`;
  }
}

function back() {
  stack.pop();
  if (stack.length) openDoc(stack[stack.length - 1]); else closeDoc();
}

export function closeDoc() {
  if (!el?.classList.contains('open')) return;
  el.classList.remove('open'); stack.length = 0;
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}
export const docOpen = () => !!el?.classList.contains('open');

/* Any link to a legal page anywhere in the app opens in the viewer */
export function initDocs() {
  document.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || a.closest('#docview')) return;
    const u = new URL(a.href, location.href);
    if (u.origin === location.origin && isDoc(u.pathname)) { e.preventDefault(); openDoc(u.pathname.replace(/^\/|\.html$/g, '')); }
  });
}
