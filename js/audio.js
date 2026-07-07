/* ============================================================
   audio.js — voice + background music.

   Voice: the pre-baked VOICEVOX clips in audio/<key>.m4a (credit
   "VOICEVOX:四国めたん", kept in the footer). Each line resolves to a
   file via the same djb2 hash the generator used (see script.js).

   BGM: a vendored, original CC0 ambient loop (audio/bgm/niechan-ambient.mp3).
   It starts on the title-gate click — the gesture browsers require before
   any audio can play — fades in, loops, and is muted via the mute toggle.
   ============================================================ */

const BGM_VOLUME = 0.55; // resting BGM level; the track sits under the voice

/* ---- background music: the vendored ambient loop ---- */
export function startBGM() {
  const audio = new Audio('./audio/bgm/niechan-ambient.mp3');
  audio.loop = true;
  audio.volume = 0;
  audio.play().catch(() => {});

  // gentle fade-in so it eases in under the opening line
  const t0 = performance.now();
  const fade = () => {
    const k = Math.min(1, (performance.now() - t0) / 3000);
    if (!audio.muted) audio.volume = BGM_VOLUME * k;
    if (k < 1) requestAnimationFrame(fade);
  };
  requestAnimationFrame(fade);

  return {
    toggleMute() {
      audio.muted = !audio.muted;
      audio.volume = audio.muted ? 0 : BGM_VOLUME;
      return audio.muted;
    },
    get muted() { return audio.muted; },
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
