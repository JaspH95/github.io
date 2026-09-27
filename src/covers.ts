/* Designed covers, for cards with no suitable photo: one family per topic, built as SVG.
   Each has the topic's gradient scene, a large topic mark and a subtle grain, so it looks deliberate. */
import { scene } from './scenes';
import { esc } from './ui';
import type { TopicKey } from './types';

export const TOPIC_SCENE: Record<TopicKey, string> = {
  news: 'globe', tech: 'network', science: 'planet', money: 'chart', culture: 'road', life: 'mind', sport: 'pitch',
  local: 'city', general: 'spark', space: 'planet', lang: 'lang', sign: 'sign', work: 'pipeline',
};
export const TOPIC_COLOUR: Record<TopicKey, string> = {
  news: '#F2B61B', tech: '#38BDF8', science: '#8B9DFF', money: '#3CCB7F', culture: '#FF7A59', life: '#E86FD0', sport: '#22C55E',
  local: '#4FD1C5', general: '#F6D365', space: '#8B9DFF', lang: '#22D3EE', sign: '#FB923C', work: '#2DD4BF',
};

let n = 0;
/* Gradient ids must be unique when several covers share a page */
function uniq(svg: string): string {
  const k = `c${++n}`;
  return svg.replace(/id="([\w-]+)"/g, `id="$1-${k}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-${k})`);
}

export function cover(topic: TopicKey, seed: number, mark?: string, sceneKind?: string): string {
  const base = uniq(scene(sceneKind || TOPIC_SCENE[topic] || 'spark', seed));
  const label = (mark || '').toUpperCase();
  return `<div class="cover" aria-hidden="true">${base}
    <svg class="grain" viewBox="0 0 200 200" preserveAspectRatio="none"><filter id="gr${n}"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter><rect width="200" height="200" filter="url(#gr${n})"/></svg>
    ${label ? `<span class="mark" style="--tc:${TOPIC_COLOUR[topic]};--len:${Math.max(4, label.length)}">${esc(label)}</span>` : ''}</div>`;
}
