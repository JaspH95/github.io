/* London Tube status via the TfL Unified API, cached for 60 seconds. Returns only lines with disruption. */

export async function GET(): Promise<Response> {
  const key = process.env.TFL_APP_KEY;
  const url = `https://api.tfl.gov.uk/Line/Mode/tube,elizabeth-line,dlr,overground/Status${key ? `?app_key=${encodeURIComponent(key)}` : ''}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`TfL HTTP ${res.status}`);
    const lines: any[] = await res.json();
    const disrupted = lines
      .map(l => ({
        id: l.id as string,
        name: l.name as string,
        statuses: (l.lineStatuses || [])
          .filter((s: any) => s.statusSeverity !== 10) // 10 = Good Service
          .map((s: any) => ({ status: s.statusSeverityDescription as string, reason: (s.reason || '') as string })),
      }))
      .filter(l => l.statuses.length);
    return new Response(JSON.stringify({ checked: new Date().toISOString(), disrupted }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=30' } });
  }
}
