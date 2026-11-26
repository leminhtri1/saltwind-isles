// Trees, palms, rocks, villages, roads, the harbour and its boats, the airfield and the lighthouse; solid ones filed as obstacles.
import { mat4Compose, mat4RotateY, mat4TransformPoint, mat4Translate } from './math3d.js';
import { MeshBuilder } from './mesh-builder.js';
import { createRandom } from './noise.js';
import { HARBOUR, LIGHTHOUSE, ROADS, STRIPS, VILLAGES, WORLD_HALF, WORLD_SEED, findStrip, stripLocal } from './world-layout.js';

const TRUNK = [0.36, 0.25, 0.17, 0], WHITE = [0.97, 0.97, 0.95, 0], WOOD = [0.55, 0.4, 0.26, 0];
const PINES = [[0.07, 0.27, 0.12, 0], [0.1, 0.33, 0.14, 0], [0.06, 0.23, 0.12, 0]];
const LEAVES = [[0.2, 0.46, 0.12, 0], [0.3, 0.52, 0.14, 0], [0.14, 0.38, 0.1, 0], [0.45, 0.56, 0.16, 0]];
const FRONDS = [[0.22, 0.5, 0.14, 0], [0.3, 0.56, 0.16, 0]];
const STONE = [[0.62, 0.6, 0.57, 0], [0.74, 0.72, 0.67, 0], [0.5, 0.49, 0.47, 0]];
const HULLS = [[0.85, 0.12, 0.1, 0], [0.1, 0.32, 0.6, 0], [0.96, 0.95, 0.92, 0], [0.1, 0.5, 0.45, 0], [0.95, 0.75, 0.15, 0]];
const WALLS = [[0.94, 0.9, 0.82, 0], [0.86, 0.8, 0.7, 0], [0.75, 0.83, 0.86, 0], [0.95, 0.84, 0.64, 0]];
const ROOFS = [[0.72, 0.3, 0.2, 0], [0.2, 0.48, 0.52, 0], [0.36, 0.38, 0.46, 0], [0.8, 0.55, 0.2, 0]];

class ObstacleGrid {
	cells = new Map();
	add(o) {
		const k = Math.floor(o.x / 100) * 100003 + Math.floor(o.z / 100);
		this.cells.set(k, [...(this.cells.get(k) || []), o]);
	}
	hit(x, y, z, pad = 0) {
		const i = Math.floor(x / 100), j = Math.floor(z / 100);
		for (let di = -1; di <= 1; di++) {
			for (let dj = -1; dj <= 1; dj++) {
				for (const o of this.cells.get((i + di) * 100003 + j + dj) || []) if (y < o.top && y > o.base - 2 && Math.hypot(x - o.x, z - o.z) < o.r + pad) return o;
			}
		}
		return null;
	}
}

const nearStrip = (x, z, margin) => STRIPS.some((s) => {
	const { along, across } = stripLocal(s, x, z);
	return Math.abs(along) < s.length / 2 + margin * 3 && Math.abs(across) < s.width / 2 + margin;
});

function pine(mb, x, y, z, s, pick) {
	const c = pick(PINES);
	mb.frustum(x, y - 0.5, z, 0.35 * s, y + 2 * s, 0.25 * s, 5, TRUNK);
	mb.frustum(x, y + 1.4 * s, z, 2.6 * s, y + 6.5 * s, 0, 6, c);
	mb.frustum(x, y + 4 * s, z, 1.9 * s, y + 9.5 * s, 0, 6, c);
}

function broadleaf(mb, x, y, z, s, pick) {
	mb.frustum(x, y - 0.5, z, 0.4 * s, y + 3 * s, 0.3 * s, 5, TRUNK);
	mb.blob(x, y + 4.6 * s, z, 3.2 * s, 2.7 * s, 3.2 * s, pick(LEAVES), 3, 6);
}

function palm(mb, x, y, z, s, pick, rnd) {
	const lx = (rnd() - 0.5) * 1.6 * s, lz = (rnd() - 0.5) * 1.6 * s, top = [x + lx * 2, y + 9 * s, z + lz * 2], c = pick(FRONDS);
	for (let k = 0; k < 3; k++) mb.frustum(x + lx * k * k / 2, y + k * 3 * s, z + lz * k * k / 2, 0.32 * s, y + (k + 1) * 3 * s, 0.26 * s, 5, k % 2 ? TRUNK : WOOD);
	for (let k = 0; k < 7; k++) {
		const a = k * 0.9 + rnd(), dx = Math.cos(a) * 4.2 * s, dz = Math.sin(a) * 4.2 * s, w = 0.19;
		const mid = [top[0] + dx / 2, top[1] + 0.5 * s, top[2] + dz / 2];
		mb.quad(top, [mid[0] - dz * w, mid[1], mid[2] + dx * w], [top[0] + dx, top[1] - 1.6 * s, top[2] + dz], [mid[0] + dz * w, mid[1], mid[2] - dx * w], c);
	}
}

function rock(mb, x, y, z, s, pick, rnd) {
	mb.blob(x, y + s * 0.3, z, s * (1 + rnd() * 0.6), s * (0.6 + rnd() * 0.4), s * (0.9 + rnd() * 0.5), pick(STONE), 3, 5);
}

function boat(mb, pick, rnd, L) {
	const w = L * 0.19, hull = pick(HULLS), deck = [[-w, 0.9, L * 0.45], [w, 0.9, L * 0.45], [w, 0.9, -L * 0.2], [0, 1.1, -L * 0.5], [-w, 0.9, -L * 0.2]];
	const keel = deck.map(([x, , z]) => [x * 0.55, -0.5, z * 0.9]);
	for (let i = 0; i < 5; i++) mb.quad(keel[i], keel[(i + 1) % 5], deck[(i + 1) % 5], deck[i], hull);
	for (const [a, b, c] of [[0, 2, 1], [0, 4, 2], [4, 3, 2]]) mb.tri(deck[a], deck[b], deck[c], WOOD);
	if (rnd() < 0.5) return mb.box(0, 1.7, L * 0.12, w * 1.2, 1.6, L * 0.3, WHITE, [0.3, 0.32, 0.35, 0]);
	mb.box(0, 0.9 + L * 0.4, -L * 0.1, 0.12, L * 0.8, 0.12, WHITE);
	const sail = [[0, 1.9, L * 0.3], [0, 0.9 + L * 0.75, -L * 0.08], [0, 1.9, -L * 0.08]];
	mb.tri(...sail, WHITE);
	mb.tri(sail[0], sail[2], sail[1], WHITE);
}

function roads(mb, terrain) {
	for (const pts of ROADS) {
		const path = [];
		pts.forEach(([x1, z1], i) => {
			const [x0, z0] = pts[i - 1] || pts[0], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 10) || 1;
			for (let k = 1; k <= n; k++) path.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n]);
		});
		const edge = (i, side) => {
			const [ax, az] = path[Math.max(0, i - 1)], [bx, bz] = path[Math.min(path.length - 1, i + 1)], l = Math.hypot(bx - ax, bz - az) / 3.5 * side;
			const x = path[i][0] + (az - bz) / l, z = path[i][1] + (bx - ax) / l;
			return [x, Math.max(0.3, terrain.heightAt(x, z)) + 0.35, z];
		};
		for (let i = 0; i < path.length - 1; i++) mb.quad(edge(i, -1), edge(i, 1), edge(i + 1, 1), edge(i + 1, -1), [0.42, 0.41, 0.4, 0]);
	}
}

function harbour(mb, pick, rnd) {
	const { x, z, angle, length: L } = HARBOUR, place = (m, len) => (mb.push(m), boat(mb, pick, rnd, len), mb.pop());
	mb.push(mat4Compose(mat4Translate(x, 0, z), mat4RotateY(-angle - Math.PI / 2)));
	mb.box(0, 1.4, -L / 2, 5, 0.4, L, WOOD);
	mb.box(0, 1.4, -L, 26, 0.4, 5, WOOD);
	for (let d = 0; d <= L; d += 10) for (const s of [-2.2, 2.2]) mb.box(s, 0, -d, 0.4, 3, 0.4, [0.3, 0.22, 0.15, 0]);
	for (let k = 0; k < 6; k++) place(mat4Compose(mat4Translate(k % 2 ? 8 : -8, 0, -25 - Math.floor(k / 2) * 30), mat4RotateY(1.57 + (rnd() - 0.5) * 0.2)), 9 + rnd() * 5);
	mb.pop();
	for (let k = 0; k < 9; k++) {
		const a = angle + (rnd() - 0.5) * 2.2, d = L + 80 + rnd() * 900;
		place(mat4Compose(mat4Translate(x + Math.cos(a) * d, 0, z + Math.sin(a) * d), mat4RotateY(rnd() * 6.3)), 8 + rnd() * 8);
	}
}

function house(mb, pick, rnd, w, d, h) {
	const wall = pick(WALLS), roof = pick(ROOFS), r = h + w * 0.42, x0 = -w / 2 - 0.5, x1 = w / 2 + 0.5, z0 = -d / 2 - 0.5, z1 = d / 2 + 0.5;
	mb.box(0, h / 2 - 1, 0, w, h + 2, d, wall);
	mb.quad([x0, h, z1], [0, r, z1], [0, r, z0], [x0, h, z0], roof);
	mb.quad([0, r, z1], [x1, h, z1], [x1, h, z0], [0, r, z0], roof);
	mb.tri([-w / 2, h, d / 2], [w / 2, h, d / 2], [0, r, d / 2], wall);
	mb.tri([w / 2, h, -d / 2], [-w / 2, h, -d / 2], [0, r, -d / 2], wall);
	mb.box(0, h * 0.4, d / 2 + 0.02, 1.1, 2.1, 0.1, [0.35, 0.22, 0.15, 0]);
	if (rnd() < 0.7) mb.box(w / 4, h * 0.62, d / 2 + 0.02, 1, 1, 0.1, [1, 0.82, 0.45, 0.85]);
}

function lighthouse(mb, x, y, z) {
	for (let k = 0; k < 6; k++) mb.frustum(x, y + k * 4.5, z, 4.2 - k * 0.25, y + (k + 1) * 4.5, 3.95 - k * 0.25, 10, k % 2 ? [0.78, 0.18, 0.15, 0] : [0.96, 0.95, 0.92, 0]);
	const top = y + 27;
	mb.frustum(x, top, z, 3.6, top + 0.8, 3.6, 10, [0.2, 0.2, 0.22, 0]);
	mb.frustum(x, top + 0.8, z, 2.2, top + 4, 2.2, 8, [1, 0.9, 0.55, 1]);
	mb.frustum(x, top + 4, z, 2.6, top + 6.5, 0, 8, [0.7, 0.16, 0.14, 0]);
	mb.box(x + 5, y + 2, z + 4, 8, 4, 6, [0.94, 0.92, 0.86, 0], [0.72, 0.3, 0.2, 0]);
	return top + 6.5;
}

function airfield(mb, obstacles) {
	const port = findStrip('port'), frame = mat4Compose(mat4Translate(port.x, port.elev, port.z), mat4RotateY(-port.heading * Math.PI / 180)), side = -port.width / 2 - 75;
	mb.push(frame);
	for (let k = 0; k < 3; k++) {
		mb.push(mat4Translate(side - 8, 0, -120 + k * 48));
		mb.box(0, 4, 0, 26, 8, 36, [0.72, 0.7, 0.66, 0]);
		for (let s = 0; s < 6; s++) {
			const A = [Math.cos(s * 0.5236) * 13.5, 8 + Math.sin(s * 0.5236) * 5], B = [Math.cos(s * 0.5236 + 0.5236) * 13.5, 8 + Math.sin(s * 0.5236 + 0.5236) * 5];
			mb.quad([...B, 18.5], [...A, 18.5], [...A, -18.5], [...B, -18.5], k === 1 ? [0.75, 0.32, 0.22, 0] : [0.55, 0.6, 0.62, 0]);
		}
		mb.box(13.1, 3.6, 0, 0.3, 7, 30, [0.32, 0.3, 0.28, 0]);
		mb.pop();
	}
	mb.box(side + 10, 6, 60, 6, 12, 6, [0.92, 0.9, 0.84, 0]);
	mb.box(side + 10, 13.5, 60, 8, 3, 8, [0.3, 0.45, 0.55, 0.25]);
	mb.box(side + 10, 15.3, 60, 9, 0.6, 9, [0.8, 0.3, 0.2, 0]);
	for (const dx of [2, 12]) mb.frustum(side + dx, 0, 120, 4, 5, 4, 10, [0.9, 0.9, 0.88, 0]);
	mb.box(side - 2, 0.03, 5, 44, 0.02, 310, [0.4, 0.4, 0.4, 0]);
	mb.box((side + 20 - port.width / 2) / 2, 0.03, 5, -side - 20 - port.width / 2, 0.02, 30, [0.36, 0.36, 0.37, 0]);
	mb.pop();
	for (const [lx, lz, r, h] of [[side - 8, -120, 16, 13], [side - 8, -72, 16, 13], [side - 8, -24, 16, 13], [side + 10, 60, 5, 16]]) {
		const [x, , z] = mat4TransformPoint(frame, [lx, 0, lz]);
		obstacles.add({ x, z, r, top: port.elev + h, base: port.elev, kind: 'building' });
	}
}

export function buildScenery(terrain) {
	const rnd = createRandom(WORLD_SEED * 31 + 7), pick = (list) => list[Math.floor(rnd() * list.length)];
	const trees = new MeshBuilder(), buildings = new MeshBuilder(), roadMesh = new MeshBuilder(), obstacles = new ObstacleGrid();
	for (let n = 0, count = 0; n < 60000 && count < 7000; n++) {
		const x = (rnd() * 2 - 1) * WORLD_HALF, z = (rnd() * 2 - 1) * WORLD_HALF, h = terrain.heightAt(x, z);
		if (h < 1.5 || h > 300 || nearStrip(x, z, 60) || Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 40) continue;
		if (terrain.flatnessAt(x, z) < 0.8) {
			if (rnd() < 0.25) rock(trees, x, h, z, 1.5 + rnd() * 3, pick, rnd);
			continue;
		}
		const shore = h < 9;
		if (rnd() > (shore ? 0.5 : terrain.forestAt(x, z) > 0.5 ? 0.9 : 0.05)) continue;
		if (VILLAGES.some((v) => Math.hypot(x - v.x, z - v.z) < v.spread * (shore ? 0.5 : 0.8))) continue;
		if (h < 3 && rnd() < 0.5) {
			rock(trees, x, h, z, 0.8 + rnd() * 1.5, pick, rnd);
			continue;
		}
		const s = 0.8 + rnd() * 0.7, kind = shore ? 2 : h > 70 || rnd() < 0.45 ? 0 : 1;
		[pine, broadleaf, palm][kind](trees, x, h, z, s, pick, rnd);
		obstacles.add({ x, z, r: 2.4 * s, top: h + [9.5, 7.5, 9][kind] * s, base: h, kind: 'tree' });
		count++;
	}
	roads(roadMesh, terrain);
	harbour(buildings, pick, rnd);
	for (const v of VILLAGES) {
		const angle = rnd() * Math.PI;
		for (let n = 0, placed = 0; n < v.count * 6 && placed < v.count; n++) {
			const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * v.spread, x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d, h = terrain.heightAt(x, z);
			if (h < 2 || terrain.flatnessAt(x, z) < 0.85 || nearStrip(x, z, 40)) continue;
			const w = 5 + rnd() * 4, dd = 4.5 + rnd() * 3, hh = 3 + rnd() * 1.5;
			buildings.push(mat4Compose(mat4Translate(x, h, z), mat4RotateY(angle + (rnd() < 0.5 ? 0 : Math.PI / 2))));
			house(buildings, pick, rnd, w, dd, hh);
			buildings.pop();
			obstacles.add({ x, z, r: Math.max(w, dd) * 0.6, top: h + hh + w * 0.42, base: h, kind: 'building' });
			placed++;
		}
	}
	const lh = terrain.heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z), lhTop = lighthouse(buildings, LIGHTHOUSE.x, lh - 0.5, LIGHTHOUSE.z);
	obstacles.add({ x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, r: 4.5, top: lhTop, base: lh, kind: 'lighthouse' });
	airfield(buildings, obstacles);
	return { trees: trees.build(), buildings: buildings.build(), roads: roadMesh.build(), obstacles, lighthouseLamp: [LIGHTHOUSE.x, lhTop - 4, LIGHTHOUSE.z] };
}
