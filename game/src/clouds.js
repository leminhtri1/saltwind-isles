// Fair-weather cumulus: towers of sunlit sprite puffs, flat-based, and the footprints that shade the ground.
import { createRandom } from './noise.js';
import { WORLD_SEED } from './world-layout.js';

export const CLOUD_COUNT = 40;

/** Puffs {pos, size, shade, seed} and a flat array of footprints [x, base, z, radius] for the shadow pass. */
export function buildClouds() {
	const rnd = createRandom(WORLD_SEED * 97 + 3), puffs = [], shadows = new Float32Array(CLOUD_COUNT * 4);
	for (let c = 0; c < CLOUD_COUNT; c++) {
		const a = rnd() * Math.PI * 2, d = 500 + Math.sqrt(rnd()) * 6800;
		const cx = Math.cos(a) * d, cz = Math.sin(a) * d, base = 560 + rnd() * 240, w = 130 + rnd() * 170;
		shadows.set([cx, base + w * 0.3, cz, w * 1.25], c * 4);
		const n = 14 + Math.floor(rnd() * 10);
		for (let p = 0; p < n; p++) {
			// a broad flat-bottomed skirt, then fewer, rounder puffs piling higher toward the middle
			const t = p / n, spread = w * (1.5 - t * 1.1), r = w * (0.5 + rnd() * 0.25) * (1 - t * 0.35);
			const pa = rnd() * Math.PI * 2, pd = Math.sqrt(rnd()) * spread;
			const y = base + r * 0.55 + t * w * 1.1 + rnd() * w * 0.15;
			puffs.push({ pos: [cx + Math.cos(pa) * pd, y, cz + Math.sin(pa) * pd * 0.7], size: r, shade: 0.86 + t * 0.14, seed: rnd() });
		}
	}
	return { puffs, shadows };
}

/** Fill a sprite batch with the puffs, far to near, so the alpha blending layers correctly. */
export function drawClouds(batch, puffs, eye, right, up) {
	const order = puffs.map((p) => [(p.pos[0] - eye[0]) ** 2 + (p.pos[1] - eye[1]) ** 2 + (p.pos[2] - eye[2]) ** 2, p]).sort((a, b) => b[0] - a[0]);
	for (const [, p] of order) batch.billboard(p.pos, p.size, [p.shade, p.shade, p.shade, p.seed], right, up);
}
