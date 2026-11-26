// Trees, villages, airfield buildings and the lighthouse, each also filed as an obstacle.
import { mat4Compose, mat4RotateY, mat4Translate } from './math3d.js';
import { MeshBuilder } from './mesh-builder.js';
import { createRandom } from './noise.js';
import { LIGHTHOUSE, STRIPS, VILLAGES, WORLD_HALF, WORLD_SEED, findStrip, stripLocal } from './world-layout.js';

const TRUNK = [0.36, 0.25, 0.17, 0];
const PINES = [[0.16, 0.33, 0.17, 0], [0.2, 0.38, 0.18, 0], [0.13, 0.29, 0.16, 0]];
const LEAVES = [[0.33, 0.5, 0.18, 0], [0.42, 0.55, 0.2, 0], [0.55, 0.52, 0.2, 0]];
const WALLS = [[0.94, 0.9, 0.82, 0], [0.86, 0.8, 0.7, 0], [0.75, 0.83, 0.86, 0], [0.95, 0.84, 0.64, 0]];
const ROOFS = [[0.72, 0.3, 0.2, 0], [0.2, 0.48, 0.52, 0], [0.36, 0.38, 0.46, 0], [0.8, 0.55, 0.2, 0]];

/** Spatial hash of obstacles: cylinders {x, z, r, top} bucketed on a 100 m grid. */
class ObstacleGrid {
  constructor() { this.cells = new Map(); }
  key(i, j) { return i * 100003 + j; }
  add(o) {
    const i = Math.floor(o.x / 100), j = Math.floor(o.z / 100);
    const k = this.key(i, j);
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k).push(o);
  }
  /** First obstacle whose cylinder contains the point, or null. */
  hit(x, y, z, pad = 0) {
    const i = Math.floor(x / 100), j = Math.floor(z / 100);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const list = this.cells.get(this.key(i + di, j + dj));
        if (!list) continue;
        for (const o of list) {
          if (y < o.top && y > o.base - 2 && Math.hypot(x - o.x, z - o.z) < o.r + pad) return o;
        }
      }
    }
    return null;
  }
}

function nearStrip(x, z, margin) {
  return STRIPS.some((s) => {
    const { along, across } = stripLocal(s, x, z);
    return Math.abs(along) < s.length / 2 + margin * 3 && Math.abs(across) < s.width / 2 + margin;
  });
}

function pine(mb, x, y, z, s, rnd) {
  const c = PINES[Math.floor(rnd() * PINES.length)];
  mb.frustum(x, y - 0.5, z, 0.35 * s, y + 2 * s, 0.25 * s, 5, TRUNK);
  mb.frustum(x, y + 1.4 * s, z, 2.6 * s, y + 6.5 * s, 0, 6, c);
  mb.frustum(x, y + 4 * s, z, 1.9 * s, y + 9.5 * s, 0, 6, c);
}

function broadleaf(mb, x, y, z, s, rnd) {
  const c = LEAVES[Math.floor(rnd() * LEAVES.length)];
  mb.frustum(x, y - 0.5, z, 0.4 * s, y + 3 * s, 0.3 * s, 5, TRUNK);
  mb.blob(x, y + 4.6 * s, z, 3.2 * s, 2.7 * s, 3.2 * s, c, 3, 6);
}

function house(mb, rnd, w, d, h) {
  const wall = WALLS[Math.floor(rnd() * WALLS.length)], roof = ROOFS[Math.floor(rnd() * ROOFS.length)];
  mb.box(0, h / 2 - 1, 0, w, h + 2, d, wall);
  const r = h + w * 0.42, o = 0.5;
  const x0 = -w / 2 - o, x1 = w / 2 + o, z0 = -d / 2 - o, z1 = d / 2 + o;
  mb.quad([x0, h, z1], [0, r, z1], [0, r, z0], [x0, h, z0], roof);
  mb.quad([0, r, z1], [x1, h, z1], [x1, h, z0], [0, r, z0], roof);
  mb.tri([x0 + o, h, z1 - o], [x1 - o, h, z1 - o], [0, r, z1 - o], wall);
  mb.tri([x1 - o, h, z0 + o], [x0 + o, h, z0 + o], [0, r, z0 + o], wall);
  mb.box(0, h * 0.4, d / 2 + 0.02, 1.1, 2.1, 0.1, [0.35, 0.22, 0.15, 0]);
  if (rnd() < 0.7) mb.box(w / 4, h * 0.62, d / 2 + 0.02, 1, 1, 0.1, [1, 0.82, 0.45, 0.85]);
}

function lighthouse(mb, x, y, z) {
  const bands = 6, bandH = 4.5;
  for (let k = 0; k < bands; k++) {
    const r0 = 4.2 - k * 0.25, r1 = 4.2 - (k + 1) * 0.25;
    mb.frustum(x, y + k * bandH, z, r0, y + (k + 1) * bandH, r1, 10, k % 2 ? [0.78, 0.18, 0.15, 0] : [0.96, 0.95, 0.92, 0]);
  }
  const top = y + bands * bandH;
  mb.frustum(x, top, z, 3.6, top + 0.8, 3.6, 10, [0.2, 0.2, 0.22, 0]);
  mb.frustum(x, top + 0.8, z, 2.2, top + 4, 2.2, 8, [1, 0.9, 0.55, 1]);
  mb.frustum(x, top + 4, z, 2.6, top + 6.5, 0, 8, [0.7, 0.16, 0.14, 0]);
  mb.box(x + 5, y + 2, z + 4, 8, 4, 6, [0.94, 0.92, 0.86, 0], [0.72, 0.3, 0.2, 0]);
  return top + 6.5;
}

function airfield(mb, obstacles) {
  const port = findStrip('port');
  const frame = mat4Compose(mat4Translate(port.x, port.elev, port.z), mat4RotateY(-port.heading * Math.PI / 180));
  mb.push(frame);
  const side = -port.width / 2 - 75;
  // hangars with curved roofs
  for (let k = 0; k < 3; k++) {
    const z = -120 + k * 48;
    mb.push(mat4Translate(side - 8, 0, z));
    mb.box(0, 4, 0, 26, 8, 36, [0.72, 0.7, 0.66, 0]);
    for (let s = 0; s < 6; s++) {
      const a0 = (s / 6) * Math.PI, a1 = ((s + 1) / 6) * Math.PI;
      const p = (a) => [Math.cos(a) * 13.5, 8 + Math.sin(a) * 5, 0];
      const A = p(a0), B = p(a1);
      mb.quad([B[0], B[1], 18.5], [A[0], A[1], 18.5], [A[0], A[1], -18.5], [B[0], B[1], -18.5], k === 1 ? [0.75, 0.32, 0.22, 0] : [0.55, 0.6, 0.62, 0]);
    }
    mb.box(13.1, 3.6, 0, 0.3, 7, 30, [0.32, 0.3, 0.28, 0]);
    mb.pop();
  }
  // control tower
  mb.push(mat4Translate(side + 10, 0, 60));
  mb.box(0, 6, 0, 6, 12, 6, [0.92, 0.9, 0.84, 0]);
  mb.box(0, 13.5, 0, 8, 3, 8, [0.3, 0.45, 0.55, 0.25]);
  mb.box(0, 15.3, 0, 9, 0.6, 9, [0.8, 0.3, 0.2, 0]);
  mb.pop();
  // fuel tanks
  mb.frustum(side + 2, 0, 120, 4, 5, 4, 10, [0.9, 0.9, 0.88, 0]);
  mb.frustum(side + 12, 0, 120, 4, 5, 4, 10, [0.9, 0.9, 0.88, 0]);
  // apron
  mb.quad([side - 24, 0.03, 160], [side + 20, 0.03, 160], [side + 20, 0.03, -150], [side - 24, 0.03, -150], [0.4, 0.4, 0.4, 0]);
  mb.quad([side + 20, 0.03, 20], [-port.width / 2, 0.03, 20], [-port.width / 2, 0.03, -10], [side + 20, 0.03, -10], [0.36, 0.36, 0.37, 0]);
  mb.pop();
  for (const [lx, lz, r, h] of [[side - 8, -120, 16, 13], [side - 8, -72, 16, 13], [side - 8, -24, 16, 13], [side + 10, 60, 5, 16]]) {
    const p = [lx, 0, lz];
    const c = Math.cos(-port.heading * Math.PI / 180), s = Math.sin(-port.heading * Math.PI / 180);
    const wx = port.x + c * p[0] + s * p[2], wz = port.z - s * p[0] + c * p[2];
    obstacles.add({ x: wx, z: wz, r, top: port.elev + h, base: port.elev, kind: 'building' });
  }
}

/** Build tree, village, landmark and airfield meshes, plus the obstacle grid. */
export function buildScenery(terrain) {
  const rnd = createRandom(WORLD_SEED * 31 + 7);
  const trees = new MeshBuilder();
  const buildings = new MeshBuilder();
  const obstacles = new ObstacleGrid();
  const treeList = [];

  for (let n = 0; n < 16000 && treeList.length < 2600; n++) {
    const x = (rnd() * 2 - 1) * WORLD_HALF, z = (rnd() * 2 - 1) * WORLD_HALF;
    const h = terrain.heightAt(x, z);
    if (h < 4.5 || h > 260) continue;
    if (terrain.flatnessAt(x, z) < 0.8) continue;
    const f = terrain.forestAt(x, z);
    if (rnd() > (f > 0.5 ? 0.85 : 0.05)) continue;
    if (nearStrip(x, z, 60)) continue;
    if (VILLAGES.some((v) => Math.hypot(x - v.x, z - v.z) < v.spread * 0.8)) continue;
    if (Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 40) continue;
    const s = 0.8 + rnd() * 0.7;
    const isPine = h > 60 || rnd() < 0.55;
    if (isPine) pine(trees, x, h, z, s, rnd);
    else broadleaf(trees, x, h, z, s, rnd);
    const top = h + (isPine ? 9.5 : 7.5) * s;
    treeList.push({ x, z, top });
    obstacles.add({ x, z, r: 2.4 * s, top, base: h, kind: 'tree' });
  }

  for (const v of VILLAGES) {
    const angle = rnd() * Math.PI;
    let placed = 0;
    for (let n = 0; n < v.count * 6 && placed < v.count; n++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * v.spread;
      const x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d;
      const h = terrain.heightAt(x, z);
      if (h < 2 || terrain.flatnessAt(x, z) < 0.85 || nearStrip(x, z, 40)) continue;
      const w = 5 + rnd() * 4, dd = 4.5 + rnd() * 3, hh = 3 + rnd() * 1.5;
      buildings.push(mat4Compose(mat4Translate(x, h, z), mat4RotateY(angle + (rnd() < 0.5 ? 0 : Math.PI / 2))));
      house(buildings, rnd, w, dd, hh);
      buildings.pop();
      obstacles.add({ x, z, r: Math.max(w, dd) * 0.6, top: h + hh + w * 0.42, base: h, kind: 'building' });
      placed++;
    }
  }

  const lh = terrain.heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
  const lhTop = lighthouse(buildings, LIGHTHOUSE.x, lh - 0.5, LIGHTHOUSE.z);
  obstacles.add({ x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, r: 4.5, top: lhTop, base: lh, kind: 'lighthouse' });
  airfield(buildings, obstacles);

  return { trees: trees.build(), buildings: buildings.build(), obstacles, treeCount: treeList.length, lighthouseLamp: [LIGHTHOUSE.x, lhTop - 4, LIGHTHOUSE.z] };
}
