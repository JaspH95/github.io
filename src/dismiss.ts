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
