/* ============================================================
   POST /api/contact — the out-of-scope conversion. Nie-chan offered to
   take a message; this delivers it via the contact service
   (shouldknowaboutyou) using its 2-step token gate, then the UI confirms.

   Body:  { name?, contact?, message }
   Reply: { ok: true } | { error }

   Server-side proxy because the contact service sets no CORS headers, so
   the browser can't call it directly — and this keeps the token flow off
   the client.
   ============================================================ */

const CONTACT = process.env.CONTACT_URL || 'https://shouldknowaboutyou.vercel.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });

  const body = await readBody(req);
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return json(res, 400, { error: 'message required' });
  const name = typeof body.name === 'string' ? body.name.slice(0, 80) : '';
  const contact = typeof body.contact === 'string' ? body.contact.slice(0, 120) : '';

  try {
    const tok = await fetch(`${CONTACT}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then((r) => r.json());
    if (!tok || !tok.token) return json(res, 502, { error: 'delivery failed' });

    const sent = await fetch(`${CONTACT}/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jwt: tok.token,
        name,
        contact,
        reply_channel: contact ? 'reply to the contact above' : '',
        message,
        context: 'via Nie-chan — niechan portfolio ask box',
      }),
    });
    if (!sent.ok) return json(res, 502, { error: 'delivery failed' });
  } catch {
    return json(res, 502, { error: 'delivery failed' });
  }

  return json(res, 200, { ok: true });
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}
