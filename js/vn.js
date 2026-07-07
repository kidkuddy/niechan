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
  const state = { nodeId: null, lineIdx: 0, name: 'Anon', askHistory: [] };
  let typing = null;      // interval while text reveals
  let awaiting = false;   // true when a full line is shown, waiting for a click
  let dynamicActive = false; // true while an AI-generated (non-SCRIPT) line owns the box
  let dynamicClick = null;   // click handler for the current dynamic line (null = swallow clicks)

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
    if (dynamicActive) { if (dynamicClick) dynamicClick(); return; } // AI line owns the box
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
    renderAskBox();
  }

  /* ---- AI free-input: a text box beside the authored hub choices ---- */
  function renderAskBox() {
    const form = document.createElement('form');
    form.className = 'ask-form';
    form.innerHTML =
      `<input id="ask-in" maxlength="200" placeholder="…or ask me anything / 何でも聞いてね" autocomplete="off" />` +
      `<button type="submit" aria-label="ask">▸</button>`;
    form.onsubmit = (e) => {
      e.preventDefault();
      const q = form.querySelector('#ask-in').value.trim();
      if (q) askFlow(q);
    };
    dom.choices.appendChild(form);
  }

  // Show an AI-generated line (no pre-baked voice — text-only for v1). Resolves
  // when the visitor advances past it, so askFlow can sequence lines.
  function showDynamic(line) {
    return new Promise((resolve) => {
      clearChoices();
      dynamicActive = true;
      let typed = false;
      dom.en.textContent = line.en || '';
      avatar.setEmote(line.emote || 'neutral');
      dom.jp.dataset.full = line.jp || '';
      typeLine(line.jp || '', () => { typed = true; dom.advanceHint.hidden = false; });
      dynamicClick = () => {
        if (!typed) { finishTyping(); typed = true; dom.advanceHint.hidden = false; return; }
        dynamicActive = false; dynamicClick = null; dom.advanceHint.hidden = true; resolve();
      };
    });
  }

  function showThinking() {
    clearChoices();
    dynamicActive = true; dynamicClick = null; // swallow clicks while the model works
    if (typing) { clearInterval(typing); typing = null; }
    avatar.setEmote('neutral');
    dom.jp.textContent = '……';
    dom.en.textContent = 'thinking…';
    dom.advanceHint.hidden = true;
  }

  async function askFlow(question) {
    dom.card.hidden = true;
    showThinking();
    let data;
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, history: state.askHistory.slice(-3) }),
      });
      data = await res.json();
      if (!res.ok || (!data.jp && !data.en)) throw new Error(data.error || 'ask failed');
    } catch (e) {
      await showDynamic({ jp: 'ごめん、頭が一瞬フリーズしちゃった……もう一回いい？', en: 'Sorry — my brain froze for a second. Try again?', emote: 'sad' });
      return renderHub();
    }
    state.askHistory.push({ q: question, a: data.en || data.jp || '' });
    if (state.askHistory.length > 6) state.askHistory.shift();
    await showDynamic(data);
    if (data.in_scope === false) return renderContactForm(question);
    return renderHub();
  }

  /* ---- out-of-scope → leave-a-message (delivered to Telegram) ---- */
  function renderContactForm(question) {
    clearChoices();
    const form = document.createElement('form');
    form.className = 'msg-form';
    form.innerHTML =
      `<input name="name" maxlength="40" placeholder="お名前 / your name" autocomplete="name" />` +
      `<input name="contact" maxlength="80" placeholder="メール等 / email or handle — so he can reply" autocomplete="email" />` +
      `<textarea name="message" maxlength="600" rows="3" placeholder="メッセージ / your message"></textarea>` +
      `<div class="msg-actions">` +
        `<button type="button" class="msg-cancel">やめる / cancel</button>` +
        `<button type="submit" class="msg-send primary">送る ▸ send</button>` +
      `</div>`;
    if (state.name && state.name !== 'Anon') form.querySelector('[name=name]').value = state.name;
    form.querySelector('[name=message]').value = question;
    form.querySelector('.msg-cancel').onclick = () => renderHub();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const message = form.querySelector('[name=message]').value.trim();
      if (!message) { form.querySelector('[name=message]').focus(); return; }
      const btn = form.querySelector('.msg-send');
      btn.disabled = true; btn.textContent = '送信中… / sending';
      let ok = false;
      try {
        const r = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: form.querySelector('[name=name]').value.trim(),
            contact: form.querySelector('[name=contact]').value.trim(),
            message,
          }),
        });
        ok = r.ok;
      } catch { ok = false; }
      if (ok) await showDynamic({ jp: 'ちゃんと送っておいたよ！お返事、待っててね。', en: "Sent it — he'll get back to you. Thanks for reaching out!", emote: 'happy' });
      else await showDynamic({ jp: 'うう、うまく送れなかった……直接メールしてくれる？ dnd@niemand.online', en: "Ugh, that didn't go through. Could you email him directly? dnd@niemand.online", emote: 'sad' });
      renderHub();
    };
    dom.choices.appendChild(form);
    setTimeout(() => { const t = form.querySelector('[name=message]'); if (t) t.focus(); }, 50);
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
    state.askHistory = [];
    dynamicActive = false; dynamicClick = null;
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
