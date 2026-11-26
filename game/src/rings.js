// Glowing target rings: torus mesh, course layout facing the next ring, and the fly-through test.
import { DEG, clamp, dot, length, mat4FromQuatPos, quatFromAttitude, quatRotate, sub } from './math3d.js';
import { meshOf } from './mesh-builder.js';

export const RING_RADIUS = 15;

export const buildRingMesh = () => meshOf((mb) => {
	const pt = (i, j) => {
		const a = i / 32 * Math.PI * 2, b = j / 6 * Math.PI * 2, rr = RING_RADIUS + Math.cos(b) * 1.25;
		return [Math.cos(a) * rr, Math.sin(a) * rr, Math.sin(b) * 1.25];
	};
	for (let i = 0; i < 32; i++) for (let j = 0; j < 6; j++) mb.quad(pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1), i % 4 < 2 ? [1, 1, 1, 1] : [0.86, 0.86, 0.86, 1]);
});

export function makeRing(pos, headingDeg, pitchDeg = 0) {
	const q = quatFromAttitude(headingDeg * DEG, clamp(pitchDeg, -20, 20) * DEG, 0);
	return { pos, q, normal: quatRotate(q, [0, 0, -1]), model: mat4FromQuatPos(q, pos), passed: false, missed: false };
}

export function layRingCourse(anchors, groundAt) {
	const pts = anchors.map((a) => [a.x, Math.max(0, groundAt(a.x, a.z)) + a.agl, a.z]);
	return pts.map((p, i) => {
		const d = i < pts.length - 1 ? sub(pts[i + 1], p) : sub(p, pts[i - 1]);
		return makeRing(p, Math.atan2(d[0], -d[2]) / DEG, Math.atan2(d[1], Math.hypot(d[0], d[2])) / DEG * 0.5);
	});
}

export function ringCrossing(ring, prev, pos) {
	const d0 = dot(sub(prev, ring.pos), ring.normal), d1 = dot(sub(pos, ring.pos), ring.normal);
	if (!(d0 < 0 && d1 >= 0)) return null;
	const t = d0 / (d0 - d1);
	const off = length(sub(prev.map((v, i) => v + (pos[i] - v) * t), ring.pos));
	return off < RING_RADIUS ? 'pass' : off < RING_RADIUS * 4 ? 'miss' : null;
}
