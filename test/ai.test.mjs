// Offline checks for the AI layer: provider fallback + answer parsing.
// No network, no keys — global.fetch is stubbed. Run: npm run test:ai
import assert from 'node:assert';
import { parseAnswer } from '../lib/answer.js';

let pass = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };

// ---- parseAnswer (answers are lines[] now — elaborate + split per sentence) ----
{
  const a = parseAnswer('{"jp":"やあ","en":"Hi","emote":"happy","in_scope":true}');
  assert.deepStrictEqual(a, { lines: [{ jp: 'やあ', en: 'Hi' }], emote: 'happy', in_scope: true });
  ok('legacy single {jp,en} → wrapped in lines[]');

  const multi = parseAnswer('{"lines":[{"jp":"あ","en":"a"},{"jp":"い","en":"b"}],"emote":"relaxed","in_scope":true}');
  assert.strictEqual(multi.lines.length, 2);
  assert.strictEqual(multi.lines[1].en, 'b');
  ok('parses multi-sentence lines[]');

  const b = parseAnswer('```json\n{"lines":[{"jp":"やあ","en":"Hi"}],"emote":"relaxed","in_scope":true}\n```');
  assert.strictEqual(b.lines[0].en, 'Hi'); assert.strictEqual(b.emote, 'relaxed');
  ok('strips ```json fences');

  const c = parseAnswer('Sure!\n{"jp":"だめ","en":"no","emote":"bogus"}');
  assert.strictEqual(c.emote, 'neutral');   // unknown emote clamped
  assert.strictEqual(c.in_scope, false);    // missing in_scope defaults closed
  ok('clamps bad emote, defaults in_scope closed');

  const d = parseAnswer('the model rambled with no json at all');
  assert.strictEqual(d.in_scope, false);
  assert.ok(d.lines[0].jp && d.lines[0].en);
  ok('garbage → safe in-character fallback');
}

// ---- provider fallback (order is GPT/github first, gemini fallback) ----
{
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('models.github')) return { ok: false, status: 500 }; // GPT primary down
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"jp":"x","en":"y"}' }] } }] }) };
  };
  process.env.GEMINI_API_KEY = 'g';
  process.env.GITHUB_MODELS_TOKEN = 't';
  const { chat } = await import('../lib/providers.js');
  const out = await chat('sys', 'usr');
  assert.strictEqual(out, '{"jp":"x","en":"y"}');
  assert.ok(calls.some((u) => u.includes('models.github')), 'tried github (GPT) first');
  assert.ok(calls.some((u) => u.includes('generativelanguage')), 'fell back to gemini');
  ok('primary (GPT) down → gemini fallback answers');

  // both down → throws
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => chat('s', 'u'), /all providers failed/);
  ok('all providers down → throws');
}

console.log(`\n${pass} checks passed`);
