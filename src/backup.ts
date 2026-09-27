/* Your data: back up to a file, restore from one, or delete everything (UK GDPR). All of it lives on this phone. */
import { allKeys, load, save, remove } from './state';
import { toast } from './ui';

export async function exportData() {
  const out: Record<string, unknown> = { app: 'knowfeed', version: 2, exported: new Date().toISOString() };
  for (const k of allKeys()) out[k] = load(k, null);
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

export function importData() { (document.getElementById('importFile') as HTMLInputElement).click(); }

export function initBackup() {
  const input = document.getElementById('importFile') as HTMLInputElement;
  input.addEventListener('change', async () => {
    const f = input.files?.[0]; input.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data?.app !== 'knowfeed' || data.version !== 2) throw new Error('not a Knowfeed backup');
      for (const [k, v] of Object.entries(data)) if (!['app', 'version', 'exported'].includes(k)) save(k, v);
      toast('Restored. Reloading…');
      setTimeout(() => location.reload(), 800);
    } catch {
      toast("That file isn't a Knowfeed backup");
    }
  });
}

export async function deleteEverything() {
  for (const k of allKeys()) remove(k);
  try { localStorage.clear(); } catch { /* blocked */ }
  try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* no caches */ }
  toast('Deleted. Starting fresh…');
  setTimeout(() => location.reload(), 700);
}
