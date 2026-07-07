/* ============================================================
   POST /api/ask — the AI free-input endpoint.

   Body:  { question: string, history?: [{q,a}] }
   Reply: { jp, en, emote, in_scope }

   Flow: fetch the grounding dossier from the data plane (shouldknowaboutme,
   with X-Api-Key so gated dates are included) → build the guardrailed
   prompt → chat() through the provider chain (Gemini → GitHub Models) →
   parse to a safe JP+EN line. TEXT-ONLY for v1 (voiced by a later ticket).
   ============================================================ */

import { chat } from '../lib/providers.js';
import { buildSystemPrompt, buildUserPrompt, parseAnswer } from '../lib/answer.js';

const DATA_PLANE = process.env.DATA_PLANE_URL || 'https://shouldknowaboutme.vercel.app';
const API_KEY = process.env.SHOULDKNOWABOUTME_API_KEY || '';
const CACHE_TTL = 5 * 60 * 1000;

let dossierCache = null; // { at, text } — reused across warm invocations

async function loadDossier() {
  if (dossierCache && Date.now() - dossierCache.at < CACHE_TTL) return dossierCache.text;
  const headers = API_KEY ? { 'X-Api-Key': API_KEY } : {};
  const list = await fetch(`${DATA_PLANE}/ls`, { headers }).then((r) => r.text());
  const files = list.split('\n').map((s) => s.trim()).filter(Boolean);
  const parts = await Promise.all(
    files.map((f) =>
      fetch(`${DATA_PLANE}/cat?filename=${encodeURIComponent(f)}`, { headers })
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => '')
    )
  );
  const text = parts.filter(Boolean).join('\n\n---\n\n');
  dossierCache = { at: Date.now(), text };
  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });

  const body = await readBody(req);
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 400) : '';
  if (!question) return json(res, 400, { error: 'question required' });
  const history = Array.isArray(body.history) ? body.history.slice(-3) : [];

  let dossier = '';
  try { dossier = await loadDossier(); } catch { /* answer still guarded, just thinner */ }

  let raw;
  try {
    raw = await chat(buildSystemPrompt(dossier), buildUserPrompt(history, question));
  } catch {
    return json(res, 502, { error: 'no answer provider available' });
  }

  return json(res, 200, parseAnswer(raw));
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
