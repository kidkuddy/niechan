# niechan — a portfolio visual novel

The **Cool** version of the portfolio. **Nie-chan** (from *Niemand* — German for
*nobody*; the running gag: every employer confirms the work was done, but
*Nobody* did it) greets the visitor, speaks Japanese with English subtitles over
generative background music, and walks them through Mohamed Sofiene Barka's
career to a contact card.

This is the **base experience** — an authored, branching visual novel. **No AI
yet**; that arrives in a later ticket. The dialogue graph is plain data, so AI
answer nodes and new routes slot in without touching the engine.

## Run it

```bash
npm run dev      # → http://localhost:8138
npm run verify   # headless Chrome: loads, starts, drives to the contact card
```

No build step — it's static files. Deploy is `vercel` from this directory.

## How it fits together

| File | Role |
|------|------|
| `index.html` | title gate + stage + dialogue box + contact card |
| `js/script.js` | **the dialogue graph as DATA** + the audio-key helpers |
| `js/vn.js` | engine: walks the graph, types text, drives voice + expression |
| `js/live2d.js` | the avatar (Live2D *Hiyori* placeholder) — cursor-follow, per-line expression, lip-sync |
| `js/audio.js` | pre-baked VOICEVOX voice playback + generative Web-Audio BGM |
| `js/main.js` | bootstrap: mount avatar, wire the title gate, start the story |
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
