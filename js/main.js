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

(async () => {
  try {
    setState('loading');
    const avatar = await mountAvatar(document.getElementById('stage'));

    const vn = createVN({
      avatar,
      dom,
      onContact: () => setState('contact'),
    });

    startBtn.disabled = false;
    startBtn.textContent = 'はじめる ▸ start';
    setState('ready');

    startBtn.addEventListener('click', () => {
      startBGM();                 // user gesture → audio unlocked
      gate.classList.add('gone');
      scene.hidden = false;
      setTimeout(() => { gate.remove(); }, 600);
      vn.start();
      setState('started');
    }, { once: true });
  } catch (e) {
    console.error(e);
    setState('error', String(e && e.message || e));
    startBtn.textContent = 'failed to load';
  }
})();
