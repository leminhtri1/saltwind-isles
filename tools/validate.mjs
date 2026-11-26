// Pre-submission checks: main.ts is deterministic, screenshots fit the gate, game/ loads nothing
// from the network, every import resolves inside game/, every module parses, and the vendored
// make.fun library is byte-identical to the kit's copy.
//   node tools/validate.mjs [path-to-kit]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from './cdp.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const kit = resolve(process.argv[2] || 'D:/claude/makefun/kit-new/flight53/best-flight-game-20261126-0057-kit');
const problems = [];
const ok = (msg) => console.log(`ok   ${msg}`);
const fail = (msg) => { problems.push(msg); console.log(`FAIL ${msg}`); };

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

// 1. two runs of main.ts write identical bytes
const runs = [0, 1].map(() => {
  const dir = mkdtempSync(join(tmpdir(), 'saltwind-out-'));
  execFileSync(process.execPath, [join(root, 'main.ts')], { env: { ...process.env, MAKEFUN_OUTPUT_DIR: dir }, stdio: 'inherit' });
  return dir;
});
const filesA = walk(runs[0]).map((f) => relative(runs[0], f)).sort();
const filesB = walk(runs[1]).map((f) => relative(runs[1], f)).sort();
if (JSON.stringify(filesA) !== JSON.stringify(filesB)) fail('the two runs wrote different file lists');
else {
  const diff = filesA.filter((f) => !readFileSync(join(runs[0], f)).equals(readFileSync(join(runs[1], f))));
  if (diff.length) fail(`the two runs differ in ${diff.join(', ')}`);
  else ok(`main.ts deterministic (${filesA.length} files)`);
}
const dossier = statSync(join(runs[0], 'dossier.json')).size;
if (dossier > 1.5 * 1024 * 1024) fail(`dossier.json is ${dossier} bytes`); else ok(`dossier.json ${(dossier / 1024).toFixed(0)} KB`);
const dj = JSON.parse(readFileSync(join(runs[0], 'dossier.json'), 'utf8'));
const text = JSON.stringify(dj);
const cut = (dj.text || '').match(/\[Cut at [^\]]+\]/);
console.log(cut ? `warn dossier text ${cut[0]}` : 'ok   dossier text holds every source file whole');
runs.forEach((d) => rmSync(d, { recursive: true, force: true }));

// 2. screenshots
const shots = readdirSync(join(root, 'screenshots')).filter((n) => !n.startsWith('.'));
if (shots.length < 3 || shots.length > 4) fail(`${shots.length} screenshots (need 3 or 4)`);
for (const n of shots) {
  const buf = readFileSync(join(root, 'screenshots', n));
  const size = imageSize(buf);
  const long = Math.max(size.width, size.height), short = Math.min(size.width, size.height);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(n)) fail(`bad screenshot name ${n}`);
  else if (buf.length > 256 * 1024) fail(`${n} is ${buf.length} bytes`);
  else if (long > 1280 || short < 480) fail(`${n} is ${size.width}x${size.height}`);
  else ok(`${n} ${size.width}x${size.height} ${(buf.length / 1024).toFixed(0)} KB`);
}

// 3. game sources: no network URLs, imports resolve inside game/, every module parses
const game = join(root, 'game');
const sources = walk(game);
const scripts = sources.filter((f) => ['.js', '.mjs'].includes(extname(f)));
const html = readFileSync(join(game, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
  const ref = m[1];
  if (ref.startsWith('data:')) continue;
  if (/^[a-z]+:|^\/\//i.test(ref)) fail(`index.html references ${ref}`);
  else if (!statSync(resolve(game, ref), { throwIfNoEntry: false })) fail(`index.html references missing ${ref}`);
}
let imports = 0;
const tmp = mkdtempSync(join(tmpdir(), 'saltwind-parse-'));
for (const file of scripts) {
  const src = readFileSync(file, 'utf8');
  if (/https?:\/\//i.test(src) || /(['"`])\/\/[a-z0-9]/i.test(src)) fail(`${relative(root, file)} mentions a network URL`);
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spec = m[1] || m[2];
    imports++;
    const target = resolve(dirname(file), spec);
    if (!spec.startsWith('.') || !target.startsWith(game) || !statSync(target, { throwIfNoEntry: false })) fail(`${relative(root, file)} imports ${spec}`);
  }
  const copy = join(tmp, relative(game, file).replace(/[\\/]/g, '_') + '.mjs');
  copyFileSync(file, copy);
  try { execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' }); } catch (e) { fail(`${relative(root, file)} does not parse: ${e.stderr}`); }
}
rmSync(tmp, { recursive: true, force: true });
const total = sources.reduce((s, f) => s + statSync(f).size, 0);
ok(`${scripts.length} modules parse, ${imports} imports resolve, game/ ${(total / 1024).toFixed(1)} KB in ${sources.length} files`);
if (total > 160 * 1024) console.log(`warn game source is ${(total / 1024).toFixed(1)} KiB, over the 160 KiB guideline`);

// 4. vendored library unchanged
const mine = readFileSync(join(root, 'vendor', 'makefun-game.ts'));
const theirs = readFileSync(join(kit, 'starter', 'vendor', 'makefun-game.ts'));
if (!mine.equals(theirs)) fail('vendor/makefun-game.ts differs from the kit'); else ok('vendor/makefun-game.ts matches the kit');

console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall checks passed');
process.exit(problems.length ? 1 : 0);
