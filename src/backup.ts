/* Export and import likes, saves, follows and settings as a JSON file */
import { toast } from './util';

const KEYS = ['kf-liked', 'kf-later2', 'kf-weights', 'kf-declined', 'kf-accepted', 'kf-profile3', 'kf-follow2', 'kf-work2', 'kf-seen', 'kf-phrases', 'kf-pod'];

export async function exportData() {
  const out: Record<string, unknown> = { app: 'knowfeed', version: 1, exported: new Date().toISOString() };
  for (const k of KEYS) { try { const v = localStorage.getItem(k); if (v) out[k] = JSON.parse(v); } catch { /* skip */ } }
  const name = `knowfeed-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(out, null, 1)], name, { type: 'application/json' });
  // On iPhone the share sheet is the easiest way to save it to Files
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Knowfeed backup' }); return; } catch (e: any) { if (e?.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup saved');
}

const input = document.getElementById('importFile') as HTMLInputElement;
input.addEventListener('change', async () => {
  const f = input.files?.[0]; input.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data?.app !== 'knowfeed') throw new Error('not a Knowfeed backup');
    for (const k of KEYS) if (k in data) localStorage.setItem(k, JSON.stringify(data[k]));
    toast('Restored. Reloading…');
    setTimeout(() => location.reload(), 800);
  } catch {
    toast("That file isn't a Knowfeed backup");
  }
});
export function importData() { input.click(); }
