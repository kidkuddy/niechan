/* ============================================================
   vn.js — the visual-novel engine. Walks the SCRIPT graph (data in
   script.js), one node at a time: types the Japanese, shows the English
   subtitle, sets the avatar's expression, plays the pre-baked voice with
   lip-sync, and renders choices / the hub / the contact card.

   The engine knows nothing about the dialogue content — swap the graph
   and it just runs. That is what lets a later ticket drop AI answer nodes
   or new routes into script.js without touching this file.
   ============================================================ */

import {
  SCRIPT, HUB_CHOICES, REACTIONS, audioText, lineKey, cleanSpoken,
} from './script.js';
import { playVoice, stopVoice } from './audio.js';

const TYPE_MS = 34; // per-character typing speed

export function createVN({ avatar, dom, onContact }) {
  const state = { nodeId: null, lineIdx: 0, name: 'Anon' };
  let typing = null;      // interval while text reveals
  let awaiting = false;   // true when a full line is shown, waiting for a click

  const fill = (s) => s.replace(/\{name\}/g, state.name);

  function clearChoices() { dom.choices.innerHTML = ''; }

  function typeLine(text, done) {
    dom.jp.textContent = '';
    let i = 0;
    dom.advanceHint.hidden = true;
    typing = setInterval(() => {
      dom.jp.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(typing); typing = null; done(); }
    }, TYPE_MS);
  }

  function finishTyping() {
    if (typing) { clearInterval(typing); typing = null; dom.jp.textContent = dom.jp.dataset.full; }
  }

  async function playLine() {
    const node = SCRIPT[state.nodeId];
    const line = node.lines[state.lineIdx];
    awaiting = false;
    clearChoices();

    const jp = fill(line.jp);
    dom.jp.dataset.full = jp;
    dom.en.textContent = fill(line.en);
    avatar.setEmote(line.emote);

    typeLine(jp, () => { awaiting = true; dom.advanceHint.hidden = false; });

    // optional short vocal gasp before a surprised line
    if (line.react) {
      const r = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
      await playVoice(lineKey(cleanSpoken(r)));
    }
    const key = (() => { const t = audioText(line); return t ? lineKey(t) : null; })();
    avatar.setSpeaking(true);
    await playVoice(key);
    avatar.setSpeaking(false);
  }

  function advance() {
    if (typing) { finishTyping(); awaiting = true; dom.advanceHint.hidden = false; return; }
    if (!awaiting) return;
    awaiting = false;
    const node = SCRIPT[state.nodeId];
    if (state.lineIdx < node.lines.length - 1) { state.lineIdx++; playLine(); }
    else endOfNode();
  }

  function endOfNode() {
    const node = SCRIPT[state.nodeId];
    dom.advanceHint.hidden = true;
    if (node.action) runAction(node.action);
    if (node.action === 'askname') return; // askname blocks on the input form
    if (node.hub) return renderHub();
    if (node.choices) return renderChoices(node.choices);
    if (node.next) return enter(node.next);
  }

  function renderChoices(choices) {
    clearChoices();
    choices.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'choice' + (c.primary ? ' primary' : '');
      b.innerHTML = `<span class="c-jp">${c.jp}</span><span class="c-en">${c.en}</span>`;
      b.onclick = () => {
        if (c.set) Object.assign(state, c.set);
        if (!c.keepCard) dom.card.hidden = true;
        pick(c.goto);
      };
      dom.choices.appendChild(b);
    });
  }

  function renderHub() {
    clearChoices();
    renderChoices(HUB_CHOICES);
  }

  function pick(goto) {
    if (goto === 'restart') { restart(); return; }
    enter(goto);
  }

  function runAction(action) {
    if (action === 'askname') return askName();
    if (action === 'showContact') { dom.card.hidden = false; if (onContact) onContact(); }
    if (action === 'bow') avatar.tap();
  }

  function askName() {
    clearChoices();
    const form = document.createElement('form');
    form.className = 'name-form';
    form.innerHTML =
      `<input id="name-in" maxlength="18" placeholder="お名前 / your name" autocomplete="off" />` +
      `<button type="submit">はじめる ▸</button>`;
    form.onsubmit = (e) => {
      e.preventDefault();
      const v = form.querySelector('#name-in').value.trim();
      state.name = v || 'Anon';
      clearChoices();
      enter('greet');
    };
    dom.choices.appendChild(form);
    setTimeout(() => form.querySelector('#name-in').focus(), 50);
  }

  function enter(nodeId) {
    state.nodeId = nodeId;
    state.lineIdx = 0;
    playLine();
  }

  function restart() {
    stopVoice();
    state.name = 'Anon';
    dom.card.hidden = true;
    enter('intro');
  }

  // clicking anywhere on the dialogue box advances the current line
  dom.box.addEventListener('click', (e) => {
    if (e.target.closest('.choices') || e.target.closest('.card')) return;
    advance();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      e.preventDefault(); advance();
    }
  });

  return { start: () => enter('intro') };
}
