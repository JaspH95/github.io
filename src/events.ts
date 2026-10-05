/* Usage events (edition_open, story_open, like, lesson_finish…), only when the person has allowed usage stats.
   No third-party trackers: for signed-in testers they go to Knowfeed's own events table. */
import { load, save, now } from './state';
import { statsAllowed } from './consent';

export interface Event { name: string; at: string; props?: Record<string, unknown> }
let list = load<Event[]>('events', []);

export function log(name: string, props?: Record<string, unknown>) {
  if (!statsAllowed()) return;   // usage stats are opt-in (see consent.ts)
  list.push({ name, at: now().toISOString(), ...(props && Object.keys(props).length ? { props } : {}) });
  if (list.length > 1000) list = list.slice(-1000);
  save('events', list);
}
export const events = () => list;
export const clearEvents = () => { list = []; save('events', list); };
