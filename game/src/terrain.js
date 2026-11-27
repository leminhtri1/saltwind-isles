// Island heightfield: noise shaped by island blobs, flattened under strips, coloured by height, slope, fields and hollows.
import { clamp, cross, lerp, lerp3, normalize, smoothstep, sub } from './math3d.js';
import { createNoise2D, fbm } from './noise.js';
import { MeshBuilder } from './mesh-builder.js';
import { ISLAND_BLOBS, SEA_FLOOR, STRIPS, TERRAIN_CELLS, VILLAGES, WORLD_HALF, WORLD_SEED, stripLocal } from './world-layout.js';

const COLORS = {
	wetSand: [0.86, 0.8, 0.66],
	grassLight: [0.36, 0.6, 0.16],
	grassDark: [0.17, 0.42, 0.12],
	forest: [0.07, 0.24, 0.09],
	chalk: [0.95, 0.93, 0.87],
	chalkShade: [0.82, 0.8, 0.74],
	rock: [0.6, 0.58, 0.54],
	rockDark: [0.45, 0.44, 0.42],
	seabed: [0.9, 0.86, 0.72],
};
const FIELDS = [[0.86, 0.76, 0.32], [0.55, 0.74, 0.22], [0.66, 0.5, 0.32], [0.74, 0.8, 0.3], [0.38, 0.6, 0.16]];

export function createTerrain(seed = WORLD_SEED) {
	const noise = createNoise2D(seed);
	const detail = createNoise2D(seed + 101);
	const N = TERRAIN_CELLS;
	const cell = (WORLD_HALF * 2) / N;

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
			h = lerp(h, s.elev, 1 - smoothstep(0, 170, Math.max(Math.abs(along) - s.length / 2 - 70, Math.abs(across) - s.width / 2 - 45, 0)));
		}
		return h;
	}

	const size = N + 1;
	const heights = new Float32Array(size * size);
	for (let j = 0; j < size; j++) {
		for (let i = 0; i < size; i++) heights[j * size + i] = flattenedHeight(-WORLD_HALF + i * cell, -WORLD_HALF + j * cell);
	}

	const at = (i, j) => heights[clamp(j, 0, N) * size + clamp(i, 0, N)];

	function heightAt(x, z) {
		const gx = (x + WORLD_HALF) / cell, gz = (z + WORLD_HALF) / cell;
		if (gx < 0 || gz < 0 || gx >= N || gz >= N) return SEA_FLOOR;
		const i = Math.floor(gx), j = Math.floor(gz);
		const fx = gx - i, fz = gz - j;
		const h00 = at(i, j), h10 = at(i + 1, j), h01 = at(i, j + 1), h11 = at(i + 1, j + 1);
		if (fx > fz) return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
		return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
	}

	function flatnessAt(x, z) {
		const e = cell * 0.5;
		const dx = heightAt(x + e, z) - heightAt(x - e, z);
		const dz = heightAt(x, z + e) - heightAt(x, z - e);
		return 2 * e / Math.hypot(dx, 2 * e, dz);
	}

	function fieldAt(x, z) {
		const v = VILLAGES.find((vv) => Math.hypot(x - vv.x, z - vv.z) < vv.spread * 2.6);
		if (!v || forestAt(x, z) > 0.55) return null;
		const a = 0.5, u = x * Math.cos(a) + z * Math.sin(a), w = -x * Math.sin(a) + z * Math.cos(a);
		const i = Math.floor(u / 70), j = Math.floor(w / 46);
		return FIELDS[((i * 7 + j * 13) % 5 + 5) % 5];
	}

	function faceColor(h, ny, x, z, jitter, hollow) {
		const n = noise(x / 90, z / 90);
		let c;
		if (h < 0) c = COLORS.seabed;
		else if (h < 0.7) c = COLORS.wetSand;
		else if (ny < 0.74 && h < 90) c = ny < 0.5 ? COLORS.chalkShade : COLORS.chalk; // sea cliffs
		else if (ny < 0.7 || h > 300 + n * 40) c = ny < 0.55 || n > 0.2 ? COLORS.rockDark : COLORS.rock;
		else {
			const f = forestAt(x, z);
			const g = clamp(0.5 + noise(x / 160 + 9, z / 160) * 0.6, 0, 1);
			const meadow = (ny > 0.92 && h < 120 && fieldAt(x, z)) || lerp3(COLORS.grassLight, COLORS.grassDark, g);
			c = lerp3(meadow, COLORS.forest, smoothstep(0.35, 0.7, f));
			if (h > 200) c = lerp3(c, COLORS.rock, smoothstep(200, 300, h) * 0.7);
		}
		const k = (1 + (jitter - 0.5) * 0.09) * clamp(1 - hollow * 0.018, 0.7, 1.08);
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
				const around = (at(i - 2, j) + at(i + 3, j) + at(i, j - 2) + at(i, j + 3) + at(i - 2, j - 2) + at(i + 3, j + 3)) / 6;
				for (const [a, b, c] of [[p00, p11, p10], [p00, p01, p11]]) {
					const n = normalize(cross(sub(b, a), sub(c, a))), m = [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3);
					mb.triWorld(a, b, c, faceColor(m[1], n[1], m[0], m[2], jitter(), m[1] > 0 ? around - m[1] : 0), n);
				}
			}
		}
		return mb.build();
	}

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
		const base = positions.length / 3;
		for (const r of [60000, WORLD_HALF]) for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) positions.push(x * r, 0, z * r) && depths.push(60);
		for (let k = 0; k < 4; k++) {
			const o0 = base + k, o1 = base + ((k + 1) % 4), i0 = base + 4 + k, i1 = base + 4 + ((k + 1) % 4);
			indices.push(o0, i0, i1, o0, i1, o1);
		}
		return { positions: new Float32Array(positions), depths: new Float32Array(depths), indices: new Uint32Array(indices) };
	}

	return { heightAt, flatnessAt, forestAt, shapedHeight, buildMesh, buildWaterGrid, cell, noise };
}
