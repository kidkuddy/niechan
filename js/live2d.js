/* ============================================================
   live2d.js — Nie-chan's avatar (placeholder: Live2D "Hiyori" sample).

   Renders Hiyori with pixi-live2d-display (MIT) on top of Live2D Cubism
   Core (Live2D Free Material License). She follows the cursor, auto-blinks,
   holds a facial expression the dialogue sets per line, and lip-syncs while
   a voice clip is playing. A later ticket swaps Hiyori for a custom Nie-chan
   model — everything here keys off emote names, not the model.

   Runtimes are loaded as classic scripts in index.html:
     window.PIXI + window.PIXI.live2d
   ============================================================ */

// Facial parameter targets per emote. Applied every frame on top of the
// running idle motion so the expression reads through the animation.
const EMOTES = {
  neutral:   { mouthForm: 0.0,  eyeSmile: 0.0, cheek: 0.0, brow: 0.0 },
  happy:     { mouthForm: 1.0,  eyeSmile: 1.0, cheek: 0.6, brow: 0.3 },
  relaxed:   { mouthForm: 0.5,  eyeSmile: 0.5, cheek: 0.3, brow: 0.1 },
  surprised: { mouthForm: 0.0,  eyeSmile: 0.0, cheek: 0.0, brow: 1.0 },
  sad:       { mouthForm: -0.8, eyeSmile: 0.0, cheek: 0.0, brow: -0.7 },
  thinking:  { mouthForm: -0.3, eyeSmile: 0.0, cheek: 0.0, brow: 0.6 },
};

export async function mountAvatar(container, model3 = './models/live2d/hiyori/Hiyori.model3.json') {
  const PIXI = window.PIXI;
  const app = new PIXI.Application({
    resizeTo: container,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  container.appendChild(app.view);

  const model = await PIXI.live2d.Live2DModel.from(model3, {
    autoInteract: false, // we drive focus ourselves so it follows the whole page
  });
  app.stage.addChild(model);
  model.anchor.set(0.5, 1.0); // anchor at her feet so she stands, grounded, in the frame

  function layout() {
    const w = container.clientWidth, h = container.clientHeight;
    if (w === 0 || h === 0) return; // container still hidden — wait for it to be shown
    app.renderer.resize(w, h);      // needed: we mount while the scene is display:none
    // Big & dominant: scale her to ~full viewport height and plant her at the
    // bottom, so the layout is anchored on her instead of a small centred figure.
    model.scale.set(1);
    model.scale.set((h * 1.02) / model.height);
    model.position.set(w / 2, h * 1.03); // feet just past the bottom edge
  }
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(container);

  // cursor-follow across the whole page, not just over the canvas
  const onMove = (e) => {
    const r = app.view.getBoundingClientRect();
    model.focus(e.clientX - r.left, e.clientY - r.top);
  };
  window.addEventListener('pointermove', onMove);

  const core = model.internalModel.coreModel;
  const setP = (id, v) => { try { core.setParameterValueById(id, v); } catch (_) {} };

  let emote = EMOTES.neutral;
  let speaking = false;
  let t = 0;

  // Layer expression + lip-sync on top of whatever motion is running.
  app.ticker.add(() => {
    t += app.ticker.deltaMS / 1000;
    setP('ParamMouthForm', emote.mouthForm);
    setP('ParamEyeLSmile', emote.eyeSmile);
    setP('ParamEyeRSmile', emote.eyeSmile);
    setP('ParamCheek', emote.cheek);
    setP('ParamBrowLY', emote.brow);
    setP('ParamBrowRY', emote.brow);
    if (speaking) {
      // cheap, believable mouth flap while a clip plays
      const open = 0.5 + 0.5 * Math.abs(Math.sin(t * 11) * Math.sin(t * 4.3));
      setP('ParamMouthOpenY', open);
    }
  });

  return {
    setEmote(name) { emote = EMOTES[name] || EMOTES.neutral; },
    setSpeaking(on) { speaking = on; if (!on) setP('ParamMouthOpenY', 0); },
    tap() { try { model.motion('TapBody'); } catch (_) {} },
    destroy() {
      window.removeEventListener('pointermove', onMove);
      ro.disconnect();
      model.destroy({ children: true });
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    },
  };
}
