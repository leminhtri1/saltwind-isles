// Capture the game's screenshots: serve game/, open each `?shot=` scene listed in shots.json in
// headless Chrome, wait for window.__shotReady and save a JPEG no larger than 200 KB.
//   node tools/shoot.mjs [--out dir] [--only name] [--query '?shot=x' --name x.jpg]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize, launchChrome, serveDir } from './cdp.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const outDir = resolve(opt('--out') || join(root, 'screenshots'));
const only = opt('--only');
const LIMIT = 200 * 1024;

const query = opt('--query');
const shots = query ? [{ name: opt('--name') || 'adhoc.jpg', query }] : JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8')).filter((s) => !only || s.name.includes(only));
mkdirSync(outDir, { recursive: true });
const { server, port } = await serveDir(join(root, 'game'));
const chrome = await launchChrome({ width: 1280, height: 800 });
let failed = false;
try {
  for (const shot of shots) {
    chrome.errors.length = 0;
    await chrome.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html${shot.query}` });
    let ready = false;
    for (let i = 0; i < 400 && !ready; i++) {
      await chrome.sleep(150);
      ready = await chrome.evaluate('window.__shotReady === true').catch(() => false);
    }
    if (!ready) {
      console.error(`${shot.name}: not ready`, chrome.errors);
      failed = true;
      continue;
    }
    let quality = 90, data;
    for (;;) {
      data = Buffer.from((await chrome.send('Page.captureScreenshot', { format: 'jpeg', quality })).data, 'base64');
      if (data.length <= LIMIT || quality <= 40) break;
      quality -= 4;
    }
    const size = imageSize(data);
    writeFileSync(join(outDir, shot.name), data);
    console.log(`${shot.name}: ${size.width}x${size.height}, ${(data.length / 1024).toFixed(1)} KB, q${quality}${chrome.errors.length ? '  ERRORS: ' + chrome.errors.join(' | ') : ''}`);
    if (chrome.errors.length) failed = true;
  }
} finally {
  await chrome.close();
  server.close();
}
process.exit(failed ? 1 : 0);
