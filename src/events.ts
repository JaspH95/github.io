/* Usage events (edition_open, story_open, like, lesson_finish…). Kept on this phone for now, with no
   third-party trackers; once accounts are switched on they'll go to Knowfeed's own events table. */
import { load, save, now } from './state';

export interface Event { name: string; at: string; props?: Record<string, unknown> }
let list = load<Event[]>('events', []);

export function log(name: string, props?: Record<string, unknown>) {
  list.push({ name, at: now().toISOString(), ...(props && Object.keys(props).length ? { props } : {}) });
  if (list.length > 1000) list = list.slice(-1000);
  save('events', list);
}
export const events = () => list;
export const clearEvents = () => { list = []; save('events', list); };
