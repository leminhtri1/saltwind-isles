// Automated play test: open the real game (no shot mode) in headless Chrome, pick Free Flight,
// open the throttle, rotate, climb and turn with dispatched key presses, and check the aircraft
// actually flies and the page logs no errors. Reads the read-only window.__flight state.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, serveDir } from './cdp.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome({ width: 1024, height: 640 });
const key = async (code, keyName, down = true) => chrome.send('Input.dispatchKeyEvent', { type: down ? 'rawKeyDown' : 'keyUp', code, key: keyName, windowsVirtualKeyCode: keyName.length === 1 ? keyName.toUpperCase().charCodeAt(0) : 0 });
const tap = async (code, keyName) => { await key(code, keyName); await chrome.sleep(120); await key(code, keyName, false); };
const state = () => chrome.evaluate('window.__flight');
const log = (label, s) => console.log(`${label.padEnd(14)} state=${s.state} mission=${s.mission} y=${s.pos ? s.pos[1].toFixed(1) : '-'} speed=${s.speedKmh.toFixed(0)} km/h ground=${s.onGround} t=${s.time.toFixed(1)} thr=${s.throttle.toFixed(2)} crashed=${s.crashed}`);
let failed = false;
try {
  await chrome.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  for (let i = 0; i < 100; i++) {
    await chrome.sleep(200);
    const s = await state().catch(() => null);
    if (s && s.state === 'title') break;
  }
  log('title', await state());
  await tap('Digit7', '7');
  await tap('Enter', 'Enter');
  await chrome.sleep(500);
  const start = await state();
  log('start', start);
  await tap('Digit0', '0');
  // take-off roll: wait until flying speed
  let s = start;
  for (let i = 0; i < 400 && s.speedKmh < 105; i++) { await chrome.sleep(250); s = await state(); }
  log('rolling', s);
  // rotate until the wheels leave the runway, then let the trimmed aircraft climb out
  await key('KeyS', 's');
  for (let i = 0; i < 200 && s.onGround; i++) { await chrome.sleep(150); s = await state(); }
  await chrome.sleep(400);
  await key('KeyS', 's', false);
  for (let i = 0; i < 300; i++) { await chrome.sleep(250); s = await state(); if (s.pos[1] > start.pos[1] + 30 || s.crashed) break; }
  log('climbing', s);
  // gentle turns timed in simulated seconds: roll right, level out, roll left, level out
  const hold = async (code, name, seconds) => {
    const t0 = (await state()).time;
    await key(code, name);
    for (let i = 0; i < 400 && (await state()).time < t0 + seconds; i++) await chrome.sleep(50);
    await key(code, name, false);
  };
  const wait = async (seconds) => { const t0 = (await state()).time; for (let i = 0; i < 800 && (await state()).time < t0 + seconds; i++) await chrome.sleep(100); };
  await hold('KeyD', 'd', 0.5);
  await wait(4);
  await hold('KeyA', 'a', 0.5);
  await wait(4);
  s = await state();
  log('after turns', s);
  const climbed = s.pos[1] - start.pos[1];
  const moved = Math.hypot(s.pos[0] - start.pos[0], s.pos[2] - start.pos[2]);
  console.log(`climbed ${climbed.toFixed(1)} m, travelled ${moved.toFixed(0)} m`);
  if (s.crashed) { console.log(`FAIL crashed: ${s.crashed}`); failed = true; }
  if (climbed < 10 || s.onGround) { console.log('FAIL did not take off'); failed = true; }
  if (moved < 300) { console.log('FAIL did not travel'); failed = true; }
  if (chrome.errors.length) { console.log('FAIL page errors:', chrome.errors); failed = true; }
  if (!failed) console.log('play test passed');
} finally {
  await chrome.close();
  server.close();
}
process.exit(failed ? 1 : 0);
