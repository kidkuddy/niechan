/* ============================================================
   providers.js — one unified chat() with ordered provider fallback.

   Adding or reordering a provider = one line in PROVIDERS. Each provider
   is skipped if its key env is unset, and skipped (with the error noted)
   if the call throws — so a dead primary transparently falls through to
   the next. chat() returns the raw text the model produced; callers parse.

   Keys and model/endpoint knobs come from env so nothing is hardcoded and
   the endpoints can be re-tuned at review without a code change (the
   hosted GitHub Models base/model names drift).
   ============================================================ */

const PROVIDERS = [
  { name: 'gemini', env: 'GEMINI_API_KEY', call: geminiChat },
  { name: 'github', env: 'GITHUB_MODELS_TOKEN', call: githubChat },
];

export async function chat(system, user) {
  const errors = [];
  for (const p of PROVIDERS) {
    const key = process.env[p.env];
    if (!key) { errors.push(`${p.name}: no key`); continue; }
    try {
      return await p.call(key, system, user);
    } catch (e) {
      errors.push(`${p.name}: ${e && e.message || e}`);
    }
  }
  throw new Error('all providers failed → ' + errors.join(' | '));
}

// --- Gemini (primary) ---
async function geminiChat(key, system, user) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new Error('empty response');
  return text;
}

// --- GitHub Models (fallback) — OpenAI-compatible chat completions ---
async function githubChat(key, system, user) {
  const base = process.env.GITHUB_MODELS_URL || 'https://models.github.ai/inference/chat/completions';
  const model = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o-mini';
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('empty response');
  return text;
}
