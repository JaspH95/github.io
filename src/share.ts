/* Share a card as a picture: a branded 4:5 image (photo or designed cover, the label, the headline, the
   Knowfeed wordmark) made on the phone with a canvas, with the link to the original alongside.
   The picture shows in a sheet first, so the Share tap is a fresh tap (iPhone only allows sharing straight
   after one), and so people see exactly what they're sending. */
import { cover, TOPIC_COLOUR } from './covers';
import { esc, seedFor, openSheet, closeSheet, toast, ICON } from './ui';
import { storyLabel, TOPIC_LABEL } from './data';
import { log } from './events';
import type { Card } from './cards';
import type { TopicKey } from './types';

export interface ShareSpec { kicker: string; title: string; sub?: string; topic: TopicKey; seed: string; image?: string; credit?: string; url: string; file?: string }

const W = 1080, H = 1350;
const SITE = 'knowfeed-nine.vercel.app';
const DISPLAY = '"Bricolage Grotesque Variable","Bricolage Grotesque","Avenir Next",system-ui,sans-serif';
const UI = '"Instrument Sans Variable","Instrument Sans",-apple-system,system-ui,sans-serif';

function loadImg(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const i = new Image();
    if (cors) i.crossOrigin = 'anonymous';
    i.referrerPolicy = 'no-referrer';
    const t = setTimeout(() => fail(new Error('timeout')), 8000);
    i.onload = () => { clearTimeout(t); ok(i); };
    i.onerror = () => { clearTimeout(t); fail(new Error('load')); };
    i.src = src;
  });
}
/* A photo, if its host allows it to be drawn (most news and Wikimedia images do); otherwise the topic cover */
async function background(spec: ShareSpec): Promise<{ img: HTMLImageElement; photo: boolean }> {
  if (spec.image && /^https?:/.test(spec.image)) {
    try { return { img: await loadImg(spec.image, true), photo: true }; } catch { /* not drawable: use the cover */ }
  }
  // The cover is an <svg> inside a wrapper; drawn on its own it needs its namespace and a size
  let svg = (cover(spec.topic, seedFor(spec.seed)).match(/<svg[\s\S]*<\/svg>/) || [''])[0];
  if (!svg) throw new Error('no cover');
  if (!/xmlns=/.test(svg.slice(0, 300))) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  svg = svg.replace('<svg', `<svg width="${W}" height="${H}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try { return { img: await loadImg(url, false), photo: false }; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const words = text.split(/\s+/); const out: string[] = []; let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  if (out.length > lines) { const kept = out.slice(0, lines); let last = kept[lines - 1]; while (ctx.measureText(last + '…').width > max && last.includes(' ')) last = last.replace(/\s+\S+$/, ''); kept[lines - 1] = last + '…'; return kept; }
  return out;
}

export async function drawShare(spec: ShareSpec): Promise<Blob> {
  await Promise.all([document.fonts?.load(`800 80px ${DISPLAY}`), document.fonts?.load(`600 34px ${UI}`)].map(p => p?.catch(() => {})));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const { img, photo } = await background(spec);
  // Cover-fit, weighted towards the top where faces usually are
  const s = Math.max(W / img.naturalWidth || 1, H / img.naturalHeight || 1);
  const iw = (img.naturalWidth || W) * s, ih = (img.naturalHeight || H) * s;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) * 0.3, iw, ih);
  // A dark foot so the words stay readable on any picture
  const g = ctx.createLinearGradient(0, H * 0.32, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(0,0,0,.72)'); g.addColorStop(1, 'rgba(0,0,0,.94)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const x = 72, max = W - x * 2;
  // Headline, then work upwards for the label
  ctx.font = `800 80px ${DISPLAY}`;
  let size = 80, lines = wrap(ctx, spec.title, max, 5);
  if (lines.length > 3) { size = 66; ctx.font = `800 ${size}px ${DISPLAY}`; lines = wrap(ctx, spec.title, max, 5); }
  const lh = size * 1.08;
  ctx.font = `500 34px ${UI}`;
  const sub = spec.sub ? wrap(ctx, spec.sub, max, 2) : [];
  const footY = H - 86;
  let y = footY - 70 - sub.length * 46 - (sub.length ? 18 : 0) - lines.length * lh;
  // Label pill in the topic colour
  ctx.font = `700 28px ${UI}`;
  const kick = spec.kicker.toUpperCase();
  const kw = ctx.measureText(kick).width + 40;
  ctx.fillStyle = TOPIC_COLOUR[spec.topic] || '#FFD23F';
  ctx.beginPath(); ctx.roundRect?.(x, y - 70, kw, 50, 25); if (!ctx.roundRect) ctx.rect(x, y - 70, kw, 50); ctx.fill();
  ctx.fillStyle = '#000'; ctx.textBaseline = 'middle'; ctx.fillText(kick, x + 20, y - 44);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff'; ctx.font = `800 ${size}px ${DISPLAY}`;
  for (const l of lines) { y += lh; ctx.fillText(l, x, y); }
  ctx.fillStyle = 'rgba(235,235,240,.86)'; ctx.font = `500 34px ${UI}`;
  if (sub.length) y += 18;
  for (const l of sub) { y += 46; ctx.fillText(l, x, y); }
  // Divider and footer: wordmark with its yellow dot, and the address
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, footY - 40, max, 2);
  ctx.fillStyle = '#fff'; ctx.font = `800 46px ${DISPLAY}`;
  ctx.fillText('Knowfeed', x, footY + 22);
  const ww = ctx.measureText('Knowfeed').width;
  ctx.fillStyle = '#FFD23F'; ctx.beginPath(); ctx.arc(x + ww + 13, footY + 15, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(235,235,240,.7)'; ctx.font = `600 28px ${UI}`; ctx.textAlign = 'right';
  ctx.fillText(SITE, W - x, footY + 20);
  // Photo credit, small, at the top
  if (photo && spec.credit) { ctx.textAlign = 'left'; ctx.font = `500 22px ${UI}`; ctx.fillStyle = 'rgba(0,0,0,.45)'; const t = `Photo: ${spec.credit}`.slice(0, 70); const tw = ctx.measureText(t).width; ctx.fillRect(x - 14, 48, tw + 28, 40); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(t, x, 76); }
  return new Promise((ok, fail) => cv.toBlob(b => (b ? ok(b) : fail(new Error('canvas'))), 'image/png'));
}

/* What to put on the picture for each kind of card */
export function specFor(c: Card): ShareSpec | null {
  const base = { topic: c.topic, seed: c.id };
  if (c.story) { const s = c.story; const n = new Set(s.articles?.map(a => a.outlet)).size; return { ...base, kicker: storyLabel(s), title: s.title, sub: n > 1 ? `Covered by ${n} outlets, including ${s.articles[0].outlet}` : s.articles?.[0]?.outlet ? `From ${s.articles[0].outlet}` : undefined, image: s.image?.url, credit: s.image?.credit, url: s.url }; }
  if (c.learn) { const l = c.learn; return { ...base, kicker: c.label || TOPIC_LABEL[c.topic], title: l.hook && l.kind === 'fact' ? l.hook : l.title, sub: l.kind === 'fact' ? `From Wikipedia: ${l.title}` : l.description || (l.source ? `From ${l.source}` : undefined), image: l.image, credit: l.credit, url: l.url }; }
  if (c.quiz) { const q = c.quiz; return { ...base, kicker: 'Quiz', title: q.q, sub: q.prompt || 'Can you get it? Answer in Knowfeed', image: q.article?.image, url: q.source.url }; }
  if (c.hub) return { ...base, kicker: c.label, title: c.hub.title, image: c.hub.image, url: c.hub.url };
  return null;
}

let lastUrl = '';
/* Make the picture, show it, then share it (or save it where sharing pictures isn't possible) */
export async function shareSpec(spec: ShareSpec, id = spec.seed) {
  const s = openSheet(`<div class="sharebox"><h3>Share</h3><div class="share-prev"><div class="skel tall"></div></div><div class="choices"></div></div>`, 'Share');
  let blob: Blob;
  try { blob = await drawShare(spec); } catch { s.querySelector('.share-prev')!.innerHTML = '<p class="note">Couldn\'t make a picture of this one. You can still share the link.</p>'; return linkOnly(s, spec); }
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  const file = new File([blob], spec.file || 'knowfeed.png', { type: 'image/png' });
  const canFiles = !!navigator.canShare?.({ files: [file] });
  s.querySelector('.share-prev')!.innerHTML = `<img src="${lastUrl}" alt="${esc(`Picture to share: ${spec.title}`)}">`;
  s.querySelector('.choices')!.innerHTML = `${canFiles ? `<button class="cta small" data-img>${ICON.share} Share picture</button>` : `<a class="cta small" data-save href="${lastUrl}" download="${esc(file.name)}">Save picture</a>`}<button class="cta ghost small" data-link>Share link</button>`;
  s.querySelector('[data-img]')?.addEventListener('click', async () => {
    try { await navigator.share({ files: [file], title: spec.title, text: `${spec.title} ${spec.url}` }); log('share', { id, as: 'image' }); closeSheet(); } catch { /* cancelled */ }
  });
  s.querySelector('[data-save]')?.addEventListener('click', () => { log('share', { id, as: 'download' }); toast('Picture saved'); });
  wireLink(s, spec, id);
}
function linkOnly(s: HTMLElement, spec: ShareSpec) { s.querySelector('.choices')!.innerHTML = '<button class="cta small" data-link>Share link</button>'; wireLink(s, spec, spec.seed); }
function wireLink(s: HTMLElement, spec: ShareSpec, id: string) {
  s.querySelector('[data-link]')?.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: spec.title, url: spec.url });
      else { await navigator.clipboard.writeText(`${spec.title} ${spec.url}`); toast('Link copied'); }
      log('share', { id, as: 'link' }); closeSheet();
    } catch { /* cancelled */ }
  });
}

export function shareCard(c: Card) {
  const spec = specFor(c);
  if (spec) shareSpec(spec, c.id);
}
