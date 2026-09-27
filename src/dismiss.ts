/* "Mark as read" and "Not interested": ways to say you've had enough of a story, so it (and the same news
   from any other outlet) never comes back. "Not interested" can also turn down or stop what brought it here:
   a topic you follow, an outlet you follow, or breaking headlines. */
import { S, persist, nudge, remember, type GoneWhy } from './state';
import { options, toast } from './ui';
import { data, OUTLETS, interestById, TOPIC_LABEL } from './data';
import type { Card } from './cards';

/* Take the card out of the feed; the next one slides into its place */
function drop(c: Card, el?: HTMLElement) {
  el ||= document.querySelector<HTMLElement>(`#feed [data-id="${CSS.escape(c.id)}"]`) || undefined;
  if (!el) return;
  document.dispatchEvent(new CustomEvent('kf-drop', { detail: el }));
}

function gone(c: Card, k: GoneWhy) {
  const s = c.story; if (!s) return;
  remember(s, k);
}

export function markDone(c: Card, el?: HTMLElement) {
  gone(c, 'done');
  drop(c, el);
  toast('Marked as read. It won’t come back');
}

export function notInterested(c: Card, el?: HTMLElement) {
  const s = c.story; const p = S.profile;
  if (!s || !p) return;
  const items: [string, string, () => void][] = [];
  const hide = (msg: string, k: GoneWhy = 'hide') => { gone(c, k); drop(c, el); toast(msg); };

  items.push(['know', 'I already know about this', () => hide('Got it. You won’t see this story again', 'know')]);
  items.push(['story', 'Not interested in this story', () => { nudge(s.topic, -0.5); hide('Hidden. You won’t see this story again'); }]);

  // A topic you follow brought it here: stop following it for news (learning about it stays)
  const topic = p.interests.find(i => i.mode !== 'learn' && (s.tags.includes(i.id) || s.via === i.label));
  if (topic) items.push(['topic', `Stop following ${topic.label} news`, () => {
    if (topic.mode === 'both') topic.mode = 'learn'; else p.interests = p.interests.filter(i => i !== topic);
    persist.profile();
    if (data.live?.topics) delete data.live.topics[topic.id];
    hide(topic.mode === 'learn' ? `No more ${topic.label} news. You’ll still learn about it` : `Stopped following ${topic.label} news`);
  }]);
  else {
    const t = s.tags.map(x => interestById.get(x)?.label).find(Boolean) || TOPIC_LABEL[s.topic];
    items.push(['fewer', `Show fewer ${t} stories`, () => { nudge(s.topic, -1); s.tags.forEach(x => nudge(x, -1)); hide(`Got it. Fewer ${t} stories`); }]);
  }

  // An outlet you follow brought it here
  const o = OUTLETS.find(x => x.name === s.via && (p.outlets || []).includes(x.id));
  if (o) items.push(['outlet', `Stop following ${o.name}`, () => {
    p.outlets = (p.outlets || []).filter(x => x !== o.id); persist.profile();
    if (data.live?.outlets) delete data.live.outlets[o.id];
    hide(`Stopped following ${o.name}`);
  }]);

  // Breaking headlines
  if (c.must && p.breaking !== false) items.push(['breaking', 'Turn off breaking headlines', () => {
    p.breaking = false; persist.profile();
    if (data.live) data.live.breaking = [];
    hide('Breaking headlines are off. Turn them back on in Profile');
  }]);

  options(items, 'Not interested');
}

/* "I know this" on a learning card: skip it, and teach that interest to go deeper (fewer well-known basics) */
export function knowThis(c: Card, el?: HTMLElement) {
  const l = c.learn; const p = S.profile;
  if (!l || !p) return;
  const skip = () => { remember(l, 'know', true); drop(c, el); };
  const it = l.interest ? p.interests.find(i => i.id === l.interest) : undefined;
  if (!it || l.kind !== 'topic') { skip(); toast('Got it. We’ll keep looking for things you don’t know'); return; }
  const label = it.label || interestById.get(it.id)?.label || 'this topic';
  const deeper = (n: number) => { S.depth[it.id] = Math.min(6, (S.depth[it.id] || 0) + n); persist.depth(); };
  options([
    ['this', 'I know this one', () => { deeper(1); skip(); toast(`Got it. ${label} will go a bit deeper`); }],
    ['basics', `I know the basics of ${label}: go deeper`, () => { deeper(2); skip(); toast(`${label}: less well-known things from now on`); }],
    ['stop', `Stop learning about ${label}`, () => {
      if (it.mode === 'both') it.mode = 'news'; else p.interests = p.interests.filter(i => i !== it);
      persist.profile(); skip(); toast(`No more ${label} learning cards`);
    }],
  ], 'I know this');
}
