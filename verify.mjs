#!/usr/bin/env node
// Headless verifier: serves the site, loads it in real Chrome (WebGL on),
// clicks the title gate, then auto-drives the story to the contact card.
// Exits non-zero if the avatar never renders or the card is never reached.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = 8139, DBG = 9224;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.m4a': 'audio/mp4', '.moc3': 'application/octet-stream', '.vcf': 'text/vcard',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const fp = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(fp);
    res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(PORT, r));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DBG}`, '--remote-debugging-address=127.0.0.1',
  '--no-first-run', '--no-default-browser-check', '--user-data-dir=/tmp/niechan-verify',
  '--autoplay-policy=no-user-gesture-required',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--window-size=1200,780',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browserWS() {
  for (let i = 0; i < 50; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await sleep(200); }
  }
  throw new Error('chrome devtools never came up');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.onmessage = (m) => { const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { const { res, rej } = this.pending.get(d.id); this.pending.delete(d.id);
        d.error ? rej(new Error(d.error.message)) : res(d.result); }
      else for (const fn of this.listeners) fn(d); }; }
  send(method, params = {}, sessionId) { const id = ++this.id; const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId; this.ws.send(JSON.stringify(msg));
    return new Promise((res, rej) => this.pending.set(id, { res, rej })); }
  on(fn) { this.listeners.push(fn); }
}
const connect = (url) => new Promise((res, rej) => {
  const ws = new WebSocket(url); ws.onopen = () => res(new CDP(ws)); ws.onerror = (e) => rej(new Error('ws ' + (e.message || ''))); });

const errors = [];
let cdp, sessionId, ok = false, reachedContact = false, hadCanvas = false;
try {
  cdp = await connect(await browserWS());
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
  cdp.on((d) => {
    if (d.sessionId !== sessionId) return;
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('ERR ' + d.params.args.map((a) => a.value || a.description || a.type).join(' '));
  });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }, sessionId);

  const evalJS = async (expression) => JSON.parse((await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)).result.value);

  // 1) wait for avatar ready
  for (let i = 0; i < 90; i++) {
    await sleep(200);
    const v = await evalJS(`JSON.stringify({state:document.getElementById('status').dataset.state,canvas:!!document.querySelector('#stage canvas'),btn:!document.getElementById('start').disabled})`);
    hadCanvas = hadCanvas || v.canvas;
    if (v.state === 'ready' && v.btn) break;
    if (v.state === 'error') throw new Error('page reported error: ' + (await evalJS(`JSON.stringify(document.getElementById('status').dataset.error||'')`)));
  }

  // 2) click the title gate to start
  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('start').click()` }, sessionId);
  await sleep(400);

  // 3) auto-drive to the contact card: fill name form, take primary/first choice, else advance
  for (let i = 0; i < 120; i++) {
    const cardShown = await evalJS(`JSON.stringify(!document.getElementById('card').hidden)`);
    if (cardShown) { reachedContact = true; break; }
    await cdp.send('Runtime.evaluate', { expression: `(() => {
      const nf = document.querySelector('#name-in');
      if (nf) { nf.value = 'Recruiter-san'; nf.form.requestSubmit(); return; }
      const prim = document.querySelector('.choice.primary') || document.querySelector('.choice');
      if (prim) { prim.click(); return; }
      document.getElementById('box').click();
    })()` }, sessionId);
    await sleep(350);
  }

  hadCanvas = hadCanvas || (await evalJS(`JSON.stringify(!!document.querySelector('#stage canvas'))`));
  ok = hadCanvas && reachedContact && errors.length === 0;

  await sleep(500);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  await writeFile(join(ROOT, '_shot-verify.png'), Buffer.from(shot.data, 'base64'));
} catch (e) {
  errors.push('FATAL ' + (e.message || e));
} finally {
  chrome.kill('SIGKILL');
  server.close();
}

console.log('\n=== niechan verification ===');
console.log(`${ok ? 'PASS' : 'FAIL'}  canvas=${hadCanvas} reachedContactCard=${reachedContact} errors=${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('   ' + e.slice(0, 180));
console.log(ok ? '\nscreenshot → _shot-verify.png' : '');
process.exit(ok ? 0 : 1);
