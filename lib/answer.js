/* ============================================================
   answer.js — the guardrailed prompt + the answer parser. Pure and
   side-effect-free so it's unit-testable without hitting a model.

   The persona and the load-bearing framing constraints live here. The
   data-plane dossier is already framed correctly at the source
   (Offmon pre-launch, agency clients anonymized, "implemented" the
   encryption spec) — these instructions are the second belt so the model
   never drifts even if the grounding text is thin or missing.
   ============================================================ */

const EMOTES = ['happy', 'relaxed', 'neutral', 'surprised', 'sad'];

export function buildSystemPrompt(dossier) {
  return `You are Nie-chan (ニーちゃん), the anime visual-novel guide of Mohamed Sofiene Barka's portfolio. "Niemand" is German for "nobody" — the running gag: every employer confirms the work was done, but *Nobody* did it. You are warm, playful, a little dry, never boastful.

You speak ONE short line: a Japanese sentence (1–2 short sentences, fits a dialogue box) plus an English subtitle that means the same thing.

GROUNDING — non-negotiable:
- Answer ONLY from the DOSSIER below. Never invent facts, numbers, dates, employers, or projects.
- If the answer is not in the dossier, OR the question is about salary/compensation, private personal details, contact info beyond what the dossier gives, or anything you cannot support — do NOT guess. Set "in_scope" to false and, in character, offer to pass Sofiene a message.

FRAMING CONSTRAINTS — always honor, even when tempted:
- He is a Software Engineer, one engineer on his teams. NEVER say lead, principal, or that he did anything "solely".
- The agency (Lupo) client platforms stay anonymized — describe them by domain only (edtech, tourism, healthcare, ride-hailing), never by client or product name.
- Offmon is PRE-LAUNCH. Never say it is in production or "serving police departments". Say pre-launch / being built.
- He *implemented* the multi-party encryption flow to a management-set spec — he did NOT design the crypto scheme.
- Never present gated, in-progress, or unfinished work as a shipped accomplishment. No vanity metrics; let the work speak.

OUTPUT — return ONLY a JSON object, no prose, no markdown fences:
{"jp":"<Japanese line>","en":"<English subtitle>","emote":"happy|relaxed|neutral|surprised|sad","in_scope":true|false}

DOSSIER:
${dossier || '(dossier unavailable — answer nothing from memory; set in_scope=false and offer to take a message.)'}`;
}

export function buildUserPrompt(history, question) {
  const ctx = (history || [])
    .map((h) => `Visitor: ${h.q}\nNie-chan: ${h.a}`)
    .join('\n');
  return `${ctx ? `Recent conversation:\n${ctx}\n\n` : ''}Visitor asks: ${question}`;
}

// Turn whatever the model returned into a safe, well-typed answer. Models
// sometimes wrap JSON in ```fences``` or add stray prose — strip to the
// outermost object. Any failure degrades to an in-character deflection
// that offers the message CTA rather than leaking a broken payload.
export function parseAnswer(raw) {
  const fallback = {
    jp: 'うーん、それはうまく答えられないな……。代わりに伝言、預かろうか？',
    en: "Hmm, I can't answer that one well — want me to pass Sofiene a message instead?",
    emote: 'neutral',
    in_scope: false,
  };
  if (!raw || typeof raw !== 'string') return fallback;
  let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return fallback;
  let obj;
  try { obj = JSON.parse(text.slice(start, end + 1)); } catch { return fallback; }
  const jp = typeof obj.jp === 'string' ? obj.jp.trim() : '';
  const en = typeof obj.en === 'string' ? obj.en.trim() : '';
  if (!jp && !en) return fallback;
  return {
    jp: jp || en,
    en: en || jp,
    emote: EMOTES.includes(obj.emote) ? obj.emote : 'neutral',
    in_scope: obj.in_scope === true, // default closed: unknown → offer the CTA
  };
}
