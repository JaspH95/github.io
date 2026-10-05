/* Designed covers, for cards with no suitable photo. They should read as deliberate editorial art, never as a
   missing image: each topic has its own palette and a detailed line illustration, set over layered glows, with
   film grain, a soft light sheen and a dark foot so the card's words stay readable. A seed (from the card's id)
   varies the palette, composition and details, so two covers of the same topic never look identical.
   All SVG, so they're sharp on any screen and weigh almost nothing. */
import { signSVG } from './scenes';
import { esc } from './ui';
import type { TopicKey } from './types';

export const TOPIC_COLOUR: Record<TopicKey, string> = {
  news: '#F2B61B', tech: '#38BDF8', science: '#8B9DFF', money: '#3CCB7F', culture: '#FF7A59', life: '#E86FD0', sport: '#22C55E',
  local: '#4FD1C5', general: '#F6D365', space: '#8B9DFF', lang: '#22D3EE', sign: '#FB923C', work: '#2DD4BF',
};
/* Kept for anything that still asks which motif a topic uses */
export const TOPIC_SCENE: Record<TopicKey, string> = {
  news: 'globe', tech: 'circuit', science: 'atom', money: 'market', culture: 'shapes', life: 'contours', sport: 'track',
  local: 'skyline', general: 'constellation', space: 'planet', lang: 'bubbles', sign: 'sign', work: 'blocks',
};

/* Palettes: [deep background, mid glow, bright glow, line colour, accent]. Two per topic, picked by seed. */
const PALETTES: Record<string, [string, string, string, string, string][]> = {
  globe: [['#120C02', '#7A4A05', '#F2B61B', '#FFE3A1', '#FF7A59'], ['#06101E', '#1C4E7A', '#F2B61B', '#FFE8B0', '#5BC0EB']],
  circuit: [['#020B18', '#0C4A6E', '#38BDF8', '#BAE6FD', '#A78BFA'], ['#0A0618', '#3B1C7A', '#38BDF8', '#C7D2FE', '#22D3EE']],
  atom: [['#07061A', '#2E2A8A', '#8B9DFF', '#D6DCFF', '#F472B6'], ['#020F14', '#0E5A63', '#5EEAD4', '#CCFBF1', '#8B9DFF']],
  market: [['#03120A', '#0F5132', '#3CCB7F', '#BBF7D0', '#FACC15'], ['#0A0F0C', '#1E3A2F', '#34D399', '#D1FAE5', '#F97316']],
  shapes: [['#1A0805', '#8A2E14', '#FF7A59', '#FFD8C9', '#FFD23F'], ['#140A1C', '#5B1F5E', '#FF7A59', '#FDE1D5', '#38BDF8']],
  contours: [['#16061A', '#6B1F5E', '#E86FD0', '#FBD5F2', '#9FF0CF'], ['#061614', '#14532D', '#9FF0CF', '#DCFCE7', '#E86FD0']],
  track: [['#03110A', '#14532D', '#22C55E', '#DCFCE7', '#FFD23F'], ['#0B0B14', '#7F1D1D', '#F87171', '#FEE2E2', '#22C55E']],
  skyline: [['#04121A', '#134E5E', '#4FD1C5', '#CCFBF1', '#FFD98A'], ['#0E0A1C', '#4C1D95', '#F472B6', '#FCE7F3', '#FFD98A']],
  constellation: [['#141003', '#5C4706', '#F6D365', '#FFF4CC', '#9FF0CF'], ['#070A1A', '#1E2A6E', '#F6D365', '#FFF4CC', '#E86FD0']],
  planet: [['#03030D', '#1E1B4B', '#8B9DFF', '#E0E7FF', '#FB923C'], ['#0A0310', '#4A1550', '#F472B6', '#FCE7F3', '#8B9DFF']],
  bubbles: [['#021317', '#0E5A6B', '#22D3EE', '#CFFAFE', '#FFD23F'], ['#100A1F', '#3B2A85', '#22D3EE', '#E0E7FF', '#F472B6']],
  blocks: [['#021412', '#115E59', '#2DD4BF', '#CCFBF1', '#FFD23F'], ['#0B0F1A', '#1E3A8A', '#60A5FA', '#DBEAFE', '#2DD4BF']],
};

function rng(seed: number) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
const f = (n: number) => n.toFixed(1);

let n = 0;
/* Gradient and filter ids must be unique when several covers share a page */
function uniq(svg: string): string {
  const k = `v${++n}`;
  return svg.replace(/id="([\w-]+)"/g, `id="$1-${k}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-${k})`);
}

type P = [string, string, string, string, string];
type Motif = (r: () => number, p: P) => string;

/* ---------- Motifs: fine-line illustrations, centred around (200, 330) so both tall cards and wide heroes show them ---------- */
const MOTIFS: Record<string, Motif> = {
  globe(r, p) {
    const cx = 200, cy = 330, R = 150, tilt = -18 + r() * 36;
    let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#sphere)"/>`;
    for (let i = -2; i <= 2; i++) { const ry = R * Math.cos((i * 30) * Math.PI / 180), y = cy + R * Math.sin((i * 30) * Math.PI / 180); s += `<ellipse cx="${cx}" cy="${f(y)}" rx="${f(ry)}" ry="${f(ry * .16)}" fill="none" stroke="${p[3]}" stroke-opacity=".28" stroke-width="1"/>`; }
    for (let i = 0; i < 6; i++) s += `<ellipse cx="${cx}" cy="${cy}" rx="${f(R * Math.abs(Math.cos(i * Math.PI / 6)))}" ry="${R}" fill="none" stroke="${p[3]}" stroke-opacity=".22" stroke-width="1" transform="rotate(${f(tilt)} ${cx} ${cy})"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${p[3]}" stroke-opacity=".55" stroke-width="1.4"/>`;
    // Flight arcs between glowing points
    const pts = [...Array(5)].map(() => { const a = r() * Math.PI * 2, d = R * (.2 + r() * .7); return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * .8]; });
    for (let i = 0; i < pts.length - 1; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 40 - r() * 50; s += `<path d="M${f(x1)} ${f(y1)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}" fill="none" stroke="${p[4]}" stroke-width="1.6" stroke-dasharray="3 5" stroke-linecap="round" opacity=".85"/>`; }
    pts.forEach(([x, y]) => { s += `<circle cx="${f(x)}" cy="${f(y)}" r="9" fill="${p[2]}" opacity=".25"/><circle cx="${f(x)}" cy="${f(y)}" r="3.2" fill="${p[3]}"/>`; });
    return s + `<ellipse cx="${cx}" cy="${cy + R + 26}" rx="${R * .8}" ry="10" fill="${p[2]}" opacity=".12"/>`;
  },
  circuit(r, p) {
    let s = '';
    const chip = 74, cx = 200, cy = 330;
    for (let i = 0; i < 26; i++) {
      const side = i % 4, k = Math.floor(i / 4), off = -30 + (k % 7) * 10;
      let x = side === 0 ? cx + off : side === 1 ? cx + chip / 2 : side === 2 ? cx + off : cx - chip / 2;
      let y = side === 0 ? cy - chip / 2 : side === 1 ? cy + off : side === 2 ? cy + chip / 2 : cy + off;
      let d = `M${f(x)} ${f(y)}`;
      for (let j = 0; j < 3; j++) {
        const len = 30 + r() * 70;
        if ((side + j) % 2 === 0) y += (side === 0 ? -1 : side === 2 ? 1 : (r() > .5 ? 1 : -1)) * len; else x += (side === 3 ? -1 : side === 1 ? 1 : (r() > .5 ? 1 : -1)) * len;
        d += ` L${f(x)} ${f(y)}`;
      }
      s += `<path d="${d}" fill="none" stroke="${p[3]}" stroke-opacity="${f(.25 + r() * .4)}" stroke-width="1.3" stroke-linejoin="round"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(2.5 + r() * 2.5)}" fill="none" stroke="${p[2]}" stroke-width="1.4"/>`;
      if (r() > .7) s += `<circle cx="${f(x)}" cy="${f(y)}" r="10" fill="${p[2]}" opacity=".18"/>`;
    }
    s += `<rect x="${cx - chip / 2}" y="${cy - chip / 2}" width="${chip}" height="${chip}" rx="10" fill="${p[0]}" stroke="${p[2]}" stroke-width="1.8"/><rect x="${cx - chip / 2 + 12}" y="${cy - chip / 2 + 12}" width="${chip - 24}" height="${chip - 24}" rx="5" fill="url(#glow)" opacity=".9"/>`;
    return s;
  },
  atom(r, p) {
    const cx = 200, cy = 330; let s = '';
    // Faint molecular lattice behind
    for (let i = 0; i < 14; i++) { const x = 30 + r() * 340, y = 120 + r() * 420, rr = 16 + r() * 10; let h = ''; for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; h += `${k ? 'L' : 'M'}${f(x + rr * Math.cos(a))} ${f(y + rr * Math.sin(a))}`; } s += `<path d="${h}Z" fill="none" stroke="${p[3]}" stroke-opacity=".1"/>`; }
    const base = r() * 60;
    for (let i = 0; i < 3; i++) {
      const rot = base + i * 60;
      s += `<ellipse cx="${cx}" cy="${cy}" rx="150" ry="46" fill="none" stroke="${p[3]}" stroke-opacity=".6" stroke-width="1.4" transform="rotate(${f(rot)} ${cx} ${cy})"/>`;
      const a = r() * Math.PI * 2, ex = cx + 150 * Math.cos(a), ey = cy + 46 * Math.sin(a);
      s += `<g transform="rotate(${f(rot)} ${cx} ${cy})"><circle cx="${f(ex)}" cy="${f(ey)}" r="12" fill="${p[4]}" opacity=".25"/><circle cx="${f(ex)}" cy="${f(ey)}" r="5" fill="${p[4]}"/></g>`;
    }
    return s + `<circle cx="${cx}" cy="${cy}" r="70" fill="url(#glow)"/><circle cx="${cx - 9}" cy="${cy - 6}" r="13" fill="${p[3]}"/><circle cx="${cx + 10}" cy="${cy + 2}" r="13" fill="${p[2]}"/><circle cx="${cx - 2}" cy="${cy + 13}" r="13" fill="${p[3]}" opacity=".85"/>`;
  },
  market(r, p) {
    let s = '';
    for (let i = 0; i < 7; i++) s += `<line x1="0" x2="400" y1="${170 + i * 50}" y2="${170 + i * 50}" stroke="${p[3]}" stroke-opacity=".07"/>`;
    let y = 470; const pts: [number, number][] = [];
    for (let i = 0; i < 13; i++) {
      const x = 30 + i * 28, open = y, close = y - (r() * 46 - 14), hi = Math.min(open, close) - r() * 22, lo = Math.max(open, close) + r() * 22, up = close < open;
      s += `<line x1="${x}" x2="${x}" y1="${f(hi)}" y2="${f(lo)}" stroke="${up ? p[2] : p[4]}" stroke-width="1.3" opacity=".9"/><rect x="${x - 7}" y="${f(Math.min(open, close))}" width="14" height="${f(Math.max(4, Math.abs(close - open)))}" rx="2" fill="${up ? p[2] : p[4]}" opacity="${up ? .9 : .75}"/>`;
      pts.push([x, close]); y = close;
    }
    const d = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x} ${f(yy - 30)}`).join(' ');
    s += `<path d="${d} L${pts[pts.length - 1][0]} 560 L${pts[0][0]} 560Z" fill="url(#fade)" opacity=".35"/><path d="${d}" fill="none" stroke="${p[3]}" stroke-width="2.4" stroke-linejoin="round"/>`;
    const [lx, ly] = pts[pts.length - 1];
    return s + `<circle cx="${lx}" cy="${f(ly - 30)}" r="16" fill="${p[3]}" opacity=".2"/><circle cx="${lx}" cy="${f(ly - 30)}" r="5" fill="${p[3]}"/>`;
  },
  shapes(r, p) {
    // A Bauhaus-style composition of arches, circles and stripes
    const ox = -20 + r() * 40, oy = -20 + r() * 40; let s = '';
    s += `<path d="M${90 + ox} ${470 + oy} V${330 + oy} A110 110 0 0 1 ${310 + ox} ${330 + oy} V${470 + oy}Z" fill="${p[1]}"/>`;
    s += `<path d="M${130 + ox} ${470 + oy} V${340 + oy} A70 70 0 0 1 ${270 + ox} ${340 + oy} V${470 + oy}Z" fill="${p[0]}" opacity=".85"/>`;
    s += `<circle cx="${290 + ox}" cy="${210 + oy}" r="${f(58 + r() * 18)}" fill="${p[2]}"/>`;
    s += `<path d="M${40 + ox} ${250 + oy} A80 80 0 0 1 ${200 + ox} ${250 + oy}Z" fill="${p[4]}" opacity=".9"/>`;
    for (let i = 0; i < 6; i++) s += `<rect x="${60 + ox + i * 16}" y="${490 + oy}" width="8" height="${f(40 + r() * 50)}" rx="4" fill="${p[3]}" opacity=".55"/>`;
    s += `<circle cx="${200 + ox}" cy="${330 + oy}" r="140" fill="none" stroke="${p[3]}" stroke-opacity=".25" stroke-dasharray="2 7"/>`;
    return s;
  },
  contours(r, p) {
    // Topographic contour lines around two peaks, with a leaf
    let s = '';
    const peaks = [[130 + r() * 60, 290 + r() * 60], [250 + r() * 60, 380 + r() * 60]];
    peaks.forEach(([px, py], k) => {
      for (let i = 1; i <= 9; i++) {
        const rr = i * 17; let d = '';
        for (let a = 0; a <= 24; a++) { const t = a / 24 * Math.PI * 2, w = 1 + .12 * Math.sin(t * 3 + i + k * 2) + .06 * Math.sin(t * 5 + i); d += `${a ? 'L' : 'M'}${f(px + Math.cos(t) * rr * w * 1.15)} ${f(py + Math.sin(t) * rr * w)}`; }
        s += `<path d="${d}Z" fill="none" stroke="${i % 3 === 0 ? p[2] : p[3]}" stroke-opacity="${f(.55 - i * .04)}" stroke-width="${i % 3 === 0 ? 1.6 : 1}"/>`;
      }
    });
    const [lx, ly] = peaks[0];
    return s + `<path d="M${f(lx)} ${f(ly + 14)} C${f(lx - 34)} ${f(ly - 10)} ${f(lx - 20)} ${f(ly - 54)} ${f(lx + 24)} ${f(ly - 60)} C${f(lx + 26)} ${f(ly - 20)} ${f(lx + 14)} ${f(ly + 4)} ${f(lx)} ${f(ly + 14)}Z" fill="${p[4]}" opacity=".9"/><path d="M${f(lx)} ${f(ly + 14)} Q${f(lx + 6)} ${f(ly - 22)} ${f(lx + 24)} ${f(ly - 60)}" stroke="${p[0]}" stroke-width="1.4" fill="none"/>`;
  },
  track(r, p) {
    // A running track in perspective under floodlights
    let s = '';
    for (let i = 0; i < 3; i++) { const x = 40 + i * 160 + r() * 30; s += `<path d="M${f(x)} 110 L${f(x - 120)} 560 L${f(x + 120)} 560Z" fill="url(#beam)" opacity=".5"/><circle cx="${f(x)}" cy="110" r="6" fill="${p[3]}"/><circle cx="${f(x)}" cy="110" r="18" fill="${p[3]}" opacity=".2"/>`; }
    for (let i = 0; i < 7; i++) { const w = 40 + i * 28; s += `<ellipse cx="200" cy="${430 + i * 6}" rx="${w * 2.6}" ry="${w * .55}" fill="none" stroke="${i % 2 ? p[3] : p[2]}" stroke-opacity="${f(.65 - i * .06)}" stroke-width="${f(1.2 + i * .3)}"/>`; }
    return s + `<ellipse cx="200" cy="430" rx="90" ry="20" fill="${p[1]}" opacity=".6"/><text x="200" y="438" text-anchor="middle" font-family="Bricolage Grotesque Variable, Bricolage Grotesque, system-ui" font-weight="800" font-size="26" fill="${p[3]}" opacity=".85">${1 + Math.floor(r() * 8)}</text>`;
  },
  skyline(r, p) {
    let s = `<circle cx="${f(110 + r() * 180)}" cy="${f(170 + r() * 50)}" r="40" fill="${p[3]}" opacity=".9"/><circle cx="${f(200)}" cy="200" r="120" fill="${p[2]}" opacity=".08"/>`;
    // Two layers of buildings, the far one fainter
    for (const [layer, base, op] of [[0, 470, .45], [1, 520, 1]] as [number, number, number][]) {
      let x = -10;
      while (x < 410) {
        const bw = 28 + r() * 46, bh = (layer ? 120 : 160) + r() * (layer ? 200 : 220);
        s += `<rect x="${f(x)}" y="${f(base - bh)}" width="${f(bw)}" height="${f(bh + 300)}" fill="${layer ? p[0] : p[1]}" opacity="${op}"/>`;
        if (r() > .6) s += `<rect x="${f(x + bw / 2 - 1)}" y="${f(base - bh - 22)}" width="2" height="22" fill="${layer ? p[0] : p[1]}"/>`;
        if (layer) for (let wy = base - bh + 12; wy < base - 8; wy += 16) for (let wx = x + 6; wx < x + bw - 6; wx += 10) if (r() > .55) s += `<rect x="${f(wx)}" y="${f(wy)}" width="4" height="7" fill="${p[4]}" opacity="${f(.35 + r() * .65)}"/>`;
        x += bw + 3;
      }
    }
    // Reflection in the river
    for (let i = 0; i < 9; i++) s += `<rect x="${f(r() * 360)}" y="${f(540 + r() * 60)}" width="${f(20 + r() * 50)}" height="1.6" fill="${p[4]}" opacity="${f(.15 + r() * .3)}"/>`;
    return s;
  },
  constellation(r, p) {
    let s = '';
    for (let i = 0; i < 120; i++) s += `<circle cx="${f(r() * 400)}" cy="${f(r() * 640)}" r="${f(r() * 1.3 + .2)}" fill="${p[3]}" opacity="${f(.2 + r() * .6)}"/>`;
    const st = [...Array(8)].map(() => [60 + r() * 280, 190 + r() * 300]);
    st.sort((a, b) => a[0] - b[0]);
    s += `<path d="${st.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join(' ')}" fill="none" stroke="${p[3]}" stroke-opacity=".55" stroke-width="1.2"/>`;
    st.forEach(([x, y], i) => { s += `<circle cx="${f(x)}" cy="${f(y)}" r="${i % 3 ? 3 : 4.5}" fill="${p[3]}"/><circle cx="${f(x)}" cy="${f(y)}" r="12" fill="${p[2]}" opacity=".2"/>`; });
    const [sx, sy] = st[Math.floor(r() * st.length)];
    return s + `<path d="M${f(sx)} ${f(sy - 46)} C${f(sx + 4)} ${f(sy - 6)} ${f(sx + 6)} ${f(sy - 4)} ${f(sx + 46)} ${f(sy)} C${f(sx + 6)} ${f(sy + 4)} ${f(sx + 4)} ${f(sy + 6)} ${f(sx)} ${f(sy + 46)} C${f(sx - 4)} ${f(sy + 6)} ${f(sx - 6)} ${f(sy + 4)} ${f(sx - 46)} ${f(sy)} C${f(sx - 6)} ${f(sy - 4)} ${f(sx - 4)} ${f(sy - 6)} ${f(sx)} ${f(sy - 46)}Z" fill="${p[2]}"/><circle cx="${f(sx)}" cy="${f(sy)}" r="34" fill="url(#glow)"/>`;
  },
  planet(r, p) {
    let s = '';
    for (let i = 0; i < 140; i++) s += `<circle cx="${f(r() * 400)}" cy="${f(r() * 700)}" r="${f(r() * 1.2 + .2)}" fill="#fff" opacity="${f(.15 + r() * .6)}"/>`;
    const cx = 190 + r() * 30, cy = 320, R = 110, tilt = -14 - r() * 14;
    s += `<ellipse cx="${f(cx)}" cy="${cy}" rx="${R * 1.9}" ry="${R * .42}" fill="none" stroke="${p[3]}" stroke-opacity=".35" stroke-width="10" transform="rotate(${f(tilt)} ${f(cx)} ${cy})"/>`;
    s += `<circle cx="${f(cx)}" cy="${cy}" r="${R}" fill="url(#sphere)"/>`;
    for (let i = 0; i < 5; i++) s += `<ellipse cx="${f(cx)}" cy="${f(cy - 60 + i * 30)}" rx="${f(R * Math.sqrt(1 - ((i * 30 - 60) / R) ** 2))}" ry="5" fill="${p[3]}" opacity=".08"/>`;
    // The front half of the ring passes over the planet
    return s + `<path d="M${f(cx - R * 1.9)} ${cy} A${R * 1.9} ${R * .42} 0 0 0 ${f(cx + R * 1.9)} ${cy}" fill="none" stroke="${p[3]}" stroke-opacity=".75" stroke-width="5" transform="rotate(${f(tilt)} ${f(cx)} ${cy})"/><circle cx="${f(cx + 150)}" cy="${cy - 140}" r="14" fill="${p[4]}" opacity=".9"/>`;
  },
  bubbles(r, p) {
    const words = ['Hola', 'Bonjour', 'Ciao', 'Hallo', 'Olá', 'Cześć', 'Merhaba', 'こんにちは', '你好', 'Привет', 'مرحبا', 'Γεια', 'Hej', 'Salut'];
    let s = '';
    const pick = [...words].sort(() => r() - .5).slice(0, 5);
    pick.forEach((w, i) => {
      const bw = 70 + w.length * 13, x = 30 + (i % 2) * (150 - r() * 60) + r() * 40, y = 170 + i * 76 + r() * 10, c = i % 2 ? p[1] : p[2];
      s += `<g opacity="${f(.65 + r() * .35)}"><rect x="${f(x)}" y="${f(y)}" width="${f(bw)}" height="54" rx="27" fill="${c}"/><path d="M${f(x + (i % 2 ? bw - 34 : 24))} ${f(y + 50)} l${i % 2 ? 12 : -8} 18 l${i % 2 ? 4 : 18} -18Z" fill="${c}"/>
        <text x="${f(x + bw / 2)}" y="${f(y + 35)}" text-anchor="middle" font-family="Bricolage Grotesque Variable, Bricolage Grotesque, system-ui, sans-serif" font-weight="700" font-size="22" fill="${i % 2 ? p[3] : p[0]}">${w}</text></g>`;
    });
    return s;
  },
  blocks(r, p) {
    // Isometric blocks rising like steps: building skills
    let s = '';
    const top = (x: number, y: number, w: number) => `M${f(x)} ${f(y)} l${f(w)} ${f(-w * .5)} l${f(w)} ${f(w * .5)} l${f(-w)} ${f(w * .5)}Z`;
    for (let i = 0; i < 5; i++) {
      const w = 40, x = 70 + i * 52, h = 50 + i * 42 + r() * 20, y = 520 - h - i * 6;
      s += `<path d="M${x} ${f(y)} l${w} ${w * .5} v${f(h)} l${-w} ${-w * .5}Z" fill="${p[1]}"/><path d="M${x + w} ${f(y + w * .5)} l${w} ${-w * .5} v${f(h)} l${-w} ${w * .5}Z" fill="${p[0]}" opacity=".9"/><path d="${top(x, y, w)}" fill="${i === 4 ? p[4] : p[2]}"/>`;
    }
    return s + `<path d="M60 470 C140 420 220 360 340 220" fill="none" stroke="${p[3]}" stroke-width="2" stroke-dasharray="4 7" stroke-linecap="round"/><path d="M340 220 l-14 2 l6 12Z" fill="${p[3]}"/>`;
  },
};

function art(kind: string, seed: number): string {
  const r = rng(seed);
  const pals = PALETTES[kind] || PALETTES.constellation;
  const p = pals[Math.floor(r() * pals.length)];
  const g1x = 20 + r() * 60, g2x = 40 + r() * 50;
  const defs = `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset=".55" stop-color="${p[0]}"/><stop offset="1" stop-color="#000"/></linearGradient>
    <radialGradient id="b1" cx="${g1x}%" cy="22%" r="55%"><stop offset="0" stop-color="${p[2]}" stop-opacity=".55"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></radialGradient>
    <radialGradient id="b2" cx="${g2x}%" cy="58%" r="45%"><stop offset="0" stop-color="${p[4]}" stop-opacity=".22"/><stop offset="1" stop-color="${p[4]}" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${p[2]}" stop-opacity=".9"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></radialGradient>
    <radialGradient id="sphere" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${p[2]}"/><stop offset=".55" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[3]}" stop-opacity=".35"/><stop offset="1" stop-color="${p[3]}" stop-opacity="0"/></linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="foot" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity=".92"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0"/></filter>
  </defs>`;
  const motif = (MOTIFS[kind] || MOTIFS.constellation)(r, p);
  return `<svg class="scene" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${defs}
    <rect width="400" height="800" fill="url(#bg)"/><rect width="400" height="800" fill="url(#b1)"/><rect width="400" height="800" fill="url(#b2)"/>
    <g filter="url(#soft)" opacity=".35">${motif}</g><g>${motif}</g>
    <rect width="400" height="800" fill="url(#sheen)"/><rect width="400" height="800" filter="url(#grain)" opacity=".07"/><rect width="400" height="800" fill="url(#foot)"/></svg>`;
}

export function cover(topic: TopicKey, seed: number, mark?: string, sceneKind?: string): string {
  const kind = sceneKind === 'lang' ? 'bubbles' : sceneKind && sceneKind !== 'sign' ? (MOTIFS[sceneKind] ? sceneKind : TOPIC_SCENE[topic]) : TOPIC_SCENE[topic] || 'constellation';
  const base = topic === 'sign' || sceneKind === 'sign' ? signSVG() : uniq(art(kind, seed));
  const label = (mark || '').toUpperCase();
  return `<div class="cover" aria-hidden="true">${base}
    ${label ? `<span class="mark" style="--tc:${TOPIC_COLOUR[topic]};--len:${Math.max(4, label.length)}">${esc(label)}</span>` : ''}</div>`;
}
