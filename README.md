# niechan — a portfolio visual novel

The **Cool** version of the portfolio. **Nie-chan** (from *Niemand* — German for
*nobody*; the running gag: every employer confirms the work was done, but
*Nobody* did it) greets the visitor, speaks Japanese with English subtitles over
generative background music, and walks them through Mohamed Sofiene Barka's
career to a contact card.

On top of the authored, branching visual novel there's an **AI ask box**: the
visitor can ask anything, and Nie-chan answers in character, grounded in the data
plane and guardrailed so she never overclaims. Out-of-scope questions (salary,
private details, anything unknown) convert into a **leave-a-message** CTA that
reaches Sofiene on Telegram — the conversion, not a dead end.

## Run it

```bash
npm run dev      # static only → http://localhost:8138 (no /api functions)
vercel dev       # full app incl. /api/ask + /api/contact (needs env, see below)
npm run verify   # headless Chrome: loads, starts, drives to the contact card
npm run test:ai  # offline: provider fallback + answer parsing
```

No build step — static files + Vercel serverless functions in `api/`. Deploy is
`vercel` from this directory.

## AI layer

| Route | What it does |
|-------|--------------|
| `POST /api/ask` | `{ question, history }` → fetches the dossier from the data plane (with `X-Api-Key` for gated dates), builds a guardrailed prompt, calls the provider chain, returns `{ jp, en, emote, in_scope }`. Text-only for v1 (voiced by the VOICEVOX ticket later). |
| `POST /api/contact` | `{ name, contact, message }` → runs shouldknowaboutyou's 2-step token flow (`POST /token` → `POST /message`) → Telegram. Server-side because that service sets no CORS headers. |

- **Providers with fallback** (`lib/providers.js`): primary **Gemini**, fallback
  **GitHub Models**, behind one `chat()` interface. A dead/absent primary falls
  through transparently. Adding or reordering a provider is one line in
  `PROVIDERS`.
- **Guardrails** (`lib/answer.js`): the Nie-chan persona + the load-bearing
  framing constraints from `master.md` (never lead/principal/solely; agency
  clients anonymized; Offmon pre-launch; *implemented* — not designed — the
  encryption spec; never present gated/unfinished work as accomplishments). The
  data-plane content is already framed correctly at the source; these are the
  second belt. Unparseable / unknown → `in_scope:false` → the message CTA.

### Env

Set in the Vercel project (see `.env.example`): `GEMINI_API_KEY`,
`GITHUB_MODELS_TOKEN`, and `SHOULDKNOWABOUTME_API_KEY` (the data plane's
`SECRET`, optional — without it answers ground on public content).

## How it fits together

| File | Role |
|------|------|
| `index.html` | title gate + stage + dialogue box + contact card |
| `js/script.js` | **the dialogue graph as DATA** + the audio-key helpers |
| `js/vn.js` | engine: walks the graph, types text, drives voice + expression |
| `js/live2d.js` | the avatar (Live2D *Hiyori* placeholder) — cursor-follow, per-line expression, lip-sync |
| `js/audio.js` | pre-baked VOICEVOX voice playback + generative Web-Audio BGM |
| `js/main.js` | bootstrap: mount avatar, wire the title gate, start the story |
| `api/ask.js` · `api/contact.js` | serverless: the AI answer + the message CTA |
| `lib/providers.js` · `lib/answer.js` | provider fallback + guardrailed prompt/parser |
| `audio/` | pre-baked VOICEVOX clips, keyed by a djb2 hash of the spoken line |
| `models/live2d/hiyori/` | the Hiyori Live2D sample model |
| `vendor/` | pixi.js + pixi-live2d-display + Live2D Cubism Core (vendored, offline) |

### The dialogue graph

`SCRIPT` in `js/script.js` is a map of nodes. Each node has `lines` (JP + EN +
`emote`), and then one of: `next` (go to another node), `choices` (branch),
`hub` (show the topic menu), or an `action` (`askname`, `showContact`, `bow`).
The engine knows nothing about the content — swap the graph and it just runs.

**Adding AI later** means adding nodes (e.g. a free-text node whose answer is
filled by a model) — no engine rewrite.

### Voice

Lines are voiced by pre-generated VOICEVOX clips in `audio/`. Each clip's
filename is a djb2 hash of the cleaned spoken text (`lineKey` in `script.js`),
so the engine finds a line's audio by hashing the same text. To regenerate the
voice (e.g. after editing lines), run a VOICEVOX engine locally and re-bake with
the generator preserved from the prototype's approach — keep the
**`VOICEVOX:四国めたん`** credit visible.

## Avatar

The avatar is the official **Live2D "Hiyori"** sample — a **placeholder**. A
custom Nie-chan model replaces it in the character-creation ticket. Everything
in `js/live2d.js` keys off emote names, not the model, so the swap is local.

## Credits / licenses

- **Voice:** VOICEVOX:四国めたん (kept in the page footer).
- **Avatar:** Live2D sample "Hiyori" © Live2D Inc. — Free Material License;
  placeholder / prototype use.
- **Runtimes:** pixi.js (MIT), pixi-live2d-display (MIT), Live2D Cubism Core
  (Live2D Free Material License).
- **Music:** generative, synthesized live with the Web Audio API (no file).
