/* ============================================================
   audio.js — voice + background music.

   Voice: the pre-baked VOICEVOX clips in audio/<key>.m4a (credit
   "VOICEVOX:四国めたん", kept in the footer). Each line resolves to a
   file via the same djb2 hash the generator used (see script.js).

   BGM: a soft, generative ambient loop built with the Web Audio API —
   no music file to license or ship. It starts on the title-gate click,
   which is also the gesture browsers require before any audio can play.
   ============================================================ */

let ctx = null;

/* ---- background music: a slow, warm generative pad ---- */
export function startBGM() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();

  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 3);
  master.connect(ctx.destination);

  // gentle low-pass so the pad stays soft and never harsh
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(master);

  // A major 9 pad — a calm, hopeful colour under the dialogue
  const pad = [220.0, 277.18, 329.63, 415.30]; // A3 C#4 E4 G#4
  pad.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? 'sine' : 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.25 / pad.length;
    // slow detune drift so it breathes instead of sitting still
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + i * 0.017;
    const lfog = ctx.createGain();
    lfog.gain.value = 1.5;
    lfo.connect(lfog).connect(o.detune);
    o.connect(g).connect(lp);
    o.start();
    lfo.start();
  });

  // sparse arpeggio twinkle every couple of seconds
  const notes = [659.25, 783.99, 987.77, 1318.51]; // E5 G5 B5 E6
  let step = 0;
  const twinkle = () => {
    if (ctx.state === 'closed') return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = notes[step++ % notes.length];
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + 1.3);
    setTimeout(twinkle, 1800 + Math.random() * 1400);
  };
  setTimeout(twinkle, 2500);

  return {
    setVolume(v) { master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.4); },
    get volume() { return master.gain.value; },
  };
}

/* ---- voice: play one pre-baked clip, resolve when it ends ---- */
let current = null;

export function playVoice(key) {
  return new Promise((resolve) => {
    if (current) { current.pause(); current = null; }
    if (!key) return resolve();
    const a = new Audio(`./audio/${key}.m4a`);
    current = a;
    a.onended = () => { if (current === a) current = null; resolve(); };
    a.onerror = () => { if (current === a) current = null; resolve(); }; // missing clip → silent, keep going
    a.play().catch(() => resolve());
  });
}

export function stopVoice() {
  if (current) { current.pause(); current = null; }
}
