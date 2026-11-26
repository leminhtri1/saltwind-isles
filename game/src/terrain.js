// Island heightfield: noise shaped by island blobs, flattened under strips, coloured by height and slope.
import { clamp, lerp, smoothstep } from './math3d.js';
import { createNoise2D, fbm } from './noise.js';
import { MeshBuilder } from './mesh-builder.js';
import { ISLAND_BLOBS, SEA_FLOOR, STRIPS, TERRAIN_CELLS, WORLD_HALF, WORLD_SEED, stripLocal } from './world-layout.js';

const COLORS = {
  sand: [0.88, 0.76, 0.52],
  wetSand: [0.74, 0.62, 0.43],
  grassLight: [0.58, 0.69, 0.3],
  grassDark: [0.36, 0.53, 0.22],
  forest: [0.25, 0.4, 0.18],
  rock: [0.55, 0.48, 0.42],
  rockDark: [0.42, 0.36, 0.33],
  snow: [0.96, 0.95, 0.97],
  seabed: [0.55, 0.5, 0.36],
};

export function createTerrain(seed = WORLD_SEED) {
  const noise = createNoise2D(seed);
  const detail = createNoise2D(seed + 101);
  const N = TERRAIN_CELLS;
  const cell = (WORLD_HALF * 2) / N;

  /** Forest density in [0, 1]: where trees cluster and the ground darkens. */
  const forestAt = (x, z) => clamp(fbm(detail, x / 420 + 40, z / 420 - 13, 3) * 1.8 + 0.2, 0, 1);

  function shapedHeight(x, z) {
    let sum = 0, peaks = 0;
    const warp = 1 + 0.22 * noise(x / 520 + 3.1, z / 520 - 7.7);
    for (const b of ISLAND_BLOBS) {
      const t = (Math.hypot(x - b.x, z - b.z) * warp) / b.r;
      if (t >= 1) continue;
      if (b.kind === 'plateau') sum += b.h * smoothstep(1, 0.3, t);
      else {
        const f = (1 - t) * (1 - t) * (1 + 2 * t);
        sum += b.h * f;
        peaks += b.h * f;
      }
    }
    let h = SEA_FLOOR + sum + fbm(noise, x / 380, z / 380, 4) * 9;
    if (h > 0) h += h * 0.2 * fbm(noise, x / 240 + 17, z / 240 - 5, 3);
    h += peaks * 0.28 * fbm(detail, x / 170, z / 170, 4);
    return h;
  }

  function flattenedHeight(x, z) {
    let h = shapedHeight(x, z);
    for (const s of STRIPS) {
      const { along, across } = stripLocal(s, x, z);
      const ea = Math.abs(along) - (s.length / 2 + 70);
      const ec = Math.abs(across) - (s.width / 2 + 45);
      const outside = Math.max(ea, ec, 0);
      const w = 1 - smoothstep(0, 170, outside);
      if (w > 0) h = lerp(h, s.elev, w);
    }
    return h;
  }

  const size = N + 1;
  const heights = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) heights[j * size + i] = flattenedHeight(-WORLD_HALF + i * cell, -WORLD_HALF + j * cell);
  }

  const at = (i, j) => heights[clamp(j, 0, N) * size + clamp(i, 0, N)];

  /** Height of the drawn surface at (x, z), interpolated on the same triangles the mesh uses. */
  function heightAt(x, z) {
    const gx = (x + WORLD_HALF) / cell, gz = (z + WORLD_HALF) / cell;
    if (gx < 0 || gz < 0 || gx >= N || gz >= N) return SEA_FLOOR;
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const h00 = at(i, j), h10 = at(i + 1, j), h01 = at(i, j + 1), h11 = at(i + 1, j + 1);
    if (fx > fz) return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
    return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }

  /** Surface normal's vertical part (1 flat, 0 a cliff) at (x, z). */
  function flatnessAt(x, z) {
    const e = cell * 0.5;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    return 2 * e / Math.hypot(dx, 2 * e, dz);
  }

  function faceColor(h, ny, x, z, jitter) {
    const n = noise(x / 90, z / 90);
    let c;
    if (h < 0) c = COLORS.seabed;
    else if (h < 2.2 + n * 1.6) c = h < 0.7 ? COLORS.wetSand : COLORS.sand;
    else if (h > 330 + n * 40 && ny > 0.55) c = COLORS.snow;
    else if (ny < 0.74 || h > 250 + n * 40) c = ny < 0.6 || n > 0.2 ? COLORS.rockDark : COLORS.rock;
    else {
      const f = forestAt(x, z);
      const g = clamp(0.5 + noise(x / 160 + 9, z / 160) * 0.6, 0, 1);
      const meadow = [lerp(COLORS.grassLight[0], COLORS.grassDark[0], g), lerp(COLORS.grassLight[1], COLORS.grassDark[1], g), lerp(COLORS.grassLight[2], COLORS.grassDark[2], g)];
      const t = smoothstep(0.35, 0.75, f);
      c = [lerp(meadow[0], COLORS.forest[0], t), lerp(meadow[1], COLORS.forest[1], t), lerp(meadow[2], COLORS.forest[2], t)];
      if (h < 4.5) c = [lerp(c[0], COLORS.sand[0], 0.35), lerp(c[1], COLORS.sand[1], 0.35), lerp(c[2], COLORS.sand[2], 0.35)];
    }
    const k = 1 + (jitter - 0.5) * 0.09;
    return [c[0] * k, c[1] * k, c[2] * k, 0];
  }

  function buildMesh() {
    const mb = new MeshBuilder();
    let r = 12345;
    const jitter = () => ((r = (Math.imul(r, 1103515245) + 12345) | 0) >>> 8 & 0xffff) / 0xffff;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x0 = -WORLD_HALF + i * cell, z0 = -WORLD_HALF + j * cell;
        const h00 = at(i, j), h10 = at(i + 1, j), h01 = at(i, j + 1), h11 = at(i + 1, j + 1);
        if (Math.max(h00, h10, h01, h11) < -4) continue;
        const p00 = [x0, h00, z0], p10 = [x0 + cell, h10, z0], p01 = [x0, h01, z0 + cell], p11 = [x0 + cell, h11, z0 + cell];
        const tris = [[p00, p11, p10], [p00, p01, p11]];
        for (const [a, b, c] of tris) {
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
          const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const nl = Math.hypot(nx, ny, nz);
          const h = (a[1] + b[1] + c[1]) / 3;
          const color = faceColor(h, ny / nl, (a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3, jitter());
          mb.triWorld(a, b, c, color, [nx / nl, ny / nl, nz / nl]);
        }
      }
    }
    return mb.build();
  }

  /** Water grid with each vertex's depth, for shallows, foam and the deep blue beyond. */
  function buildWaterGrid(step = 2) {
    const n = N / step;
    const positions = [], depths = [], indices = [];
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const x = -WORLD_HALF + i * step * cell, z = -WORLD_HALF + j * step * cell;
        positions.push(x, 0, z);
        depths.push(clamp(-at(i * step, j * step), -10, 60));
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
        indices.push(a, c, d, a, d, b);
      }
    }
    // A wide skirt of deep sea out to the horizon.
    const far = 60000, base = positions.length / 3;
    const ring = [[-far, -far], [far, -far], [far, far], [-far, far]];
    const inner = [[-WORLD_HALF, -WORLD_HALF], [WORLD_HALF, -WORLD_HALF], [WORLD_HALF, WORLD_HALF], [-WORLD_HALF, WORLD_HALF]];
    for (const [x, z] of ring) { positions.push(x, 0, z); depths.push(60); }
    for (const [x, z] of inner) { positions.push(x, 0, z); depths.push(60); }
    for (let k = 0; k < 4; k++) {
      const o0 = base + k, o1 = base + ((k + 1) % 4), i0 = base + 4 + k, i1 = base + 4 + ((k + 1) % 4);
      indices.push(o0, i0, i1, o0, i1, o1);
    }
    return { positions: new Float32Array(positions), depths: new Float32Array(depths), indices: new Uint32Array(indices) };
  }

  return { heightAt, flatnessAt, forestAt, shapedHeight, buildMesh, buildWaterGrid, cell, noise };
}
