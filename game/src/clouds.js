// Fair-weather cumulus: clusters of flattened low-poly puffs drifting at 500 to 900 metres,
// sunlit on top and shaded underneath in the same faceted style as the islands.
import { MeshBuilder } from './mesh-builder.js';
import { createRandom } from './noise.js';
import { WORLD_SEED } from './world-layout.js';

const TOP = [1.0, 0.97, 0.93, 0.35];
const BASE = [0.78, 0.74, 0.8, 0.2];

export function buildClouds() {
  const rnd = createRandom(WORLD_SEED * 97 + 3);
  const mb = new MeshBuilder();
  for (let c = 0; c < 46; c++) {
    const a = rnd() * Math.PI * 2, d = 600 + Math.sqrt(rnd()) * 6500;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = 520 + rnd() * 420;
    const puffs = 4 + Math.floor(rnd() * 5);
    const size = 60 + rnd() * 70;
    for (let p = 0; p < puffs; p++) {
      const px = cx + (rnd() - 0.5) * size * 2.6, pz = cz + (rnd() - 0.5) * size * 1.6;
      const r = size * (0.55 + rnd() * 0.6);
      mb.blob(px, cy + r * 0.25, pz, r, r * 0.62, r * 0.9, TOP, 4, 8, BASE);
    }
  }
  return mb.build();
}
