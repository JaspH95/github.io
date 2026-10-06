/* Feedback by email: every note written in the app ("Something wrong?" on a card, or Send feedback in settings)
   is emailed to Jasper through Resend's free plan.
     POST /api/feedback  { text, item?, title?, page?, token? }
   Signed-in testers send their Supabase session token: it's checked with Supabase, and their email becomes the
   reply-to address. Notes from people who aren't signed in arrive without an address.
   Needs RESEND_API_KEY. FEEDBACK_TO (default jasperhayward@me.com) and FEEDBACK_FROM are optional. Until Resend
   is set up with a verified domain, the sender is Resend's onboarding address, which can only send to the email
   the Resend account was made with, so make the account with the address in FEEDBACK_TO. */

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const ALLOWED = /^https:\/\/(knowfeed-nine\.vercel\.app|knowfeed[-a-z0-9]*\.vercel\.app)$|^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/;

/* Who sent it: only trusted if Supabase says the token is a real, current session */
async function sender(token: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL?.trim(), anon = process.env.SUPABASE_ANON_KEY?.trim();
  if (!token || !url || !anon) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const u = await r.json();
    return typeof u?.email === 'string' ? u.email : null;
  } catch { return null; }
}

export async function POST(request: Request): Promise<Response> {
  // Only from Knowfeed itself (a browser always sends Origin on a POST like this)
  const origin = request.headers.get('origin') || '';
  if (!ALLOWED.test(origin)) return reply({ ok: false, error: 'origin' }, 403);
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return reply({ ok: false, error: 'not set up' }, 503);
  let b: any;
  try { b = await request.json(); } catch { return reply({ ok: false, error: 'bad request' }, 400); }
  if (b?.website) return reply({ ok: true });   // a form-filling bot: say thanks and drop it
  const text = clean(b?.text, 2000);
  if (text.length < 2) return reply({ ok: false, error: 'empty' }, 400);
  const title = clean(b?.title, 300), item = clean(b?.item, 200), page = clean(b?.page, 100);
  const from = await sender(clean(b?.token, 4000));
  const to = process.env.FEEDBACK_TO?.trim() || 'jasperhayward@me.com';
  const subject = `Knowfeed feedback: ${text.replace(/\s+/g, ' ').slice(0, 60)}${text.length > 60 ? '…' : ''}`;
  const rows: [string, string][] = [['From', from || 'Not signed in'], ...(title ? [['About', title]] as [string, string][] : []), ...(item ? [['Card id', item]] as [string, string][] : []), ...(page ? [['Screen', page]] as [string, string][] : []), ['Sent', new Date().toUTCString()]];
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#15132A">
    <p style="font-size:17px;white-space:pre-wrap;margin:0 0 16px">${esc(text)}</p>
    <table style="border-collapse:collapse;font-size:13px;color:#5E5A78">${rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;font-weight:600">${esc(k)}</td><td style="padding:2px 0">${esc(v)}</td></tr>`).join('')}</table>
    <p style="font-size:12px;color:#8E8AA6;margin-top:18px">Sent from Knowfeed's feedback button.${from ? ' Reply to this email to answer the tester.' : ''}</p></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM?.trim() || 'Knowfeed feedback <onboarding@resend.dev>',
        to: [to], subject, html,
        text: `${text}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`,
        ...(from ? { reply_to: from } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return reply({ ok: false, error: `email ${r.status}` }, 502);
    return reply({ ok: true });
  } catch {
    return reply({ ok: false, error: 'email' }, 502);
  }
}
