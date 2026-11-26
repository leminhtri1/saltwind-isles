// Saltwind Isles hand-in (Node 22, standard library only). The game is game/: static files a desktop
// browser opens offline (index.html plus its ES modules, raw WebGL2, no library, no network request).
// This program copies game/ and screenshots/ beside it into the output directory and writes
// dossier.json with the vendored make.fun library, deterministically: two runs write the same bytes.
//
//   node serve.ts                                      play locally at http://localhost:8080
//   node tools/shoot.mjs                               re-capture screenshots/ from ?shot= scenes
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shotsDir = join(here, 'screenshots');

// Only real images go in, so a stray editor file can never change the dossier.
const isImage = (name: string) => /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png)$/i.test(name);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  for (const name of readdirSync(shotsDir).filter(isImage).sort()) {
    cpSync(join(shotsDir, name), join(out, 'screenshots', name));
  }
}

// The scorer's caps (reference/gate.json): text_max_bytes shapes the dossier; the others refuse what
// the scorer would refuse (over 4 screenshots or one over 256 KiB; over 993 entries or 48 MiB in
// game/, or a path over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
