/* ============================================================
   main.js — bootstrap. Mounts the avatar, wires the title gate
   (whose click unlocks audio), and starts the visual novel.
   ============================================================ */

import { mountAvatar } from './live2d.js';
import { createVN } from './vn.js';
import { startBGM } from './audio.js';

const status = document.getElementById('status'); // headless-verifier hook
const setState = (s, err) => { status.dataset.state = s; if (err) status.dataset.error = err; };

const gate = document.getElementById('gate');
const scene = document.getElementById('scene');
const startBtn = document.getElementById('start');

const dom = {
  box: document.getElementById('box'),
  jp: document.getElementById('jp'),
  en: document.getElementById('en'),
  choices: document.getElementById('choices'),
  advanceHint: document.getElementById('advance-hint'),
  card: document.getElementById('card'),
};

// Info modal — independent of the story.
(function chrome() {
  const modal = document.getElementById('info-modal');
  document.getElementById('info').addEventListener('click', () => { modal.hidden = false; });
  document.getElementById('info-close').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
})();

(async () => {
  try {
    setState('loading');
    const avatar = await mountAvatar(document.getElementById('stage'));

    const vn = createVN({
      avatar,
      dom,
      onContact: () => setState('contact'),
    });

    setState('ready');
    const tourBtn = document.getElementById('start');
    const chatBtn = document.getElementById('start-chat');
    tourBtn.hidden = true;   // guided disabled for now — chat is the way in
    chatBtn.disabled = false; chatBtn.textContent = '▸ はじめる / start';

    let begun = false;
    const begin = (mode) => {
      if (begun) return; begun = true;                 // user gesture → audio unlocked
      const bgm = startBGM();
      gate.classList.add('gone');
      scene.hidden = false;
      setTimeout(() => { gate.remove(); }, 600);

      const muteBtn = document.getElementById('mute');
      muteBtn.addEventListener('click', () => {
        const muted = bgm.toggleMute();
        muteBtn.textContent = muted ? '🔇' : '♪';
        muteBtn.classList.toggle('muted', muted);
      });

      if (mode === 'chat') vn.startChat(); else vn.start();
      setState('started');
    };
    tourBtn.addEventListener('click', () => begin('tour'));
    chatBtn.addEventListener('click', () => begin('chat'));
  } catch (e) {
    console.error(e);
    setState('error', String(e && e.message || e));
    startBtn.textContent = 'failed to load';
  }
})();
