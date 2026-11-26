// The Kittiwake bush plane: lofted fuselage, strut-braced high wing, moving surfaces, spatted gear, propeller.
import { cross, mat4Compose, mat4RotateX, mat4RotateY, mat4RotateZ, mat4Translate, normalize, sub } from './math3d.js';
import { meshOf as mesh } from './mesh-builder.js';

const CREAM = [0.98, 0.94, 0.84, 0], RED = [0.78, 0.07, 0.06, 0], NAVY = [0.08, 0.16, 0.24, 0], GLASS = [0.1, 0.16, 0.22, 0.05];
const DARK = [0.13, 0.13, 0.14, 0], METAL = [0.6, 0.62, 0.64, 0], UNDER = [0.84, 0.8, 0.72, 0], FLAP = [0.9, 0.86, 0.75, 0];

export const GEAR_HEIGHT = 1.35;

export const HINGES = { wingTrailing: { y: 1.2, z: -0.08 }, elevator: { y: 0.62, z: 3.45 }, rudder: { z: 3.5 }, prop: { y: 0.05, z: -3.5 } };

export const NAV_LIGHTS = [
	{ p: [-5.62, 1.22, -0.7], c: [1, 0.12, 0.08] }, { p: [5.62, 1.22, -0.7], c: [0.1, 1, 0.3] },
	{ p: [0, 0.66, 4.0], c: [1, 1, 1] }, { p: [0, 2.2, 3.3], c: [1, 0.2, 0.1], flash: true },
];

function beam(mb, a, b, w) {
	const d = normalize(sub(b, a)), u = normalize(cross(d, [0, 0, 1])), v = cross(d, u);
	const corner = (p, k) => p.map((c, i) => c + (u[i] * Math.cos(k * 1.5708) + v[i] * Math.sin(k * 1.5708)) * w);
	for (let k = 0; k < 4; k++) mb.quad(corner(a, k), corner(a, k + 1), corner(b, k + 1), corner(b, k), METAL);
}

function wheel(mb, x, y, z, r, w) {
	mb.push(mat4Compose(mat4Translate(x, y, z), mat4RotateZ(Math.PI / 2)));
	mb.frustum(0, -w / 2, 0, r, w / 2, r, 10, [0.08, 0.08, 0.09, 0], [0.5, 0.5, 0.52, 0]);
	mb.pop();
}

function panel(mb, x0, x1, zf, zt, y, t, top, bottom = top) {
	const yb = y - t / 2, yt = y + t / 2, zm = zf + (zt - zf) * 0.3, ring = (x) => [[x, yt - t * 0.2, zf], [x, yt, zm], [x, y + t * 0.1, zt], [x, yb, zm]];
	const A = ring(x0), B = ring(x1);
	for (let k = 0; k < 4; k++) mb.quad(A[(k + 1) % 4], B[(k + 1) % 4], B[k], A[k], k === 0 || k === 1 ? top : bottom);
	for (const [p, s] of [[A, 0], [B, 1]]) {
		mb.tri(p[0], p[1 + s], p[2 - s], top);
		mb.tri(p[0], p[2 + s], p[3 - s], top);
	}
}

function buildBody(mb) {
	const side = (glass) => [CREAM, RED, RED, CREAM, RED, RED, RED, RED].map((c, k) => (glass && (k === 0 || k === 3) ? GLASS : c));
	const front = [CREAM, GLASS, GLASS, CREAM, RED, NAVY, NAVY, RED];
	mb.loft([
		{ z: -3.35, w: 0.42, h: 0.42, y: 0.05, color: RED }, { z: -2.6, w: 0.56, h: 0.56, y: 0.08, color: RED },
		{ z: -1.7, w: 0.62, h: 0.7, y: 0.2, colors: front }, { z: -1.0, w: 0.64, h: 0.84, y: 0.3, colors: side(true) },
		{ z: 0.1, w: 0.63, h: 0.82, y: 0.3, colors: side(true) }, { z: 0.5, w: 0.62, h: 0.8, y: 0.3, colors: side(false) },
		{ z: 1.7, w: 0.42, h: 0.52, y: 0.38, colors: side(false) }, { z: 3.3, w: 0.18, h: 0.26, y: 0.58, colors: side(false) },
		{ z: 3.95, w: 0.08, h: 0.14, y: 0.62, color: RED },
	]);
	for (let k = 0; k < 4; k++) mb.box(0, 0.63, -2.75 + k * 0.17, 0.42, 0.03, 0.06, DARK);
	mb.box(0, -0.5, -2.65, 0.36, 0.14, 0.4, DARK);
	for (const s of [-1, 1]) {
		mb.box(s * 0.45, -0.38, -2.3, 0.1, 0.1, 0.5, DARK);
		for (const z of [-0.42, -1.02]) mb.box(s * 0.63, 0.32, z, 0.02, 0.9, 0.025, DARK);
		mb.box(s * 0.7, -0.45, -0.75, 0.25, 0.04, 0.16, METAL);
		mb.box(s * 1.6, 1.33, -0.8, 0.14, 0.03, 0.14, DARK);
	}
	[-5.6, -4.5, -4.2, -3.9, 3.9, 4.2, 4.5, 5.6].forEach((x, i, xs) => i < 7 && panel(mb, x, xs[i + 1], -1.35, -0.08, 1.22, 0.2, i % 2 ? CREAM : RED, i % 2 ? UNDER : RED));
	mb.box(0, 1.28, -0.7, 1.3, 0.1, 1.1, CREAM);
	panel(mb, -0.7, 0.7, -0.08, 0.35, 1.22, 0.08, CREAM);
	for (const s of [-1, 1]) {
		beam(mb, [s * 2.6, 1.12, -0.55], [s * 0.58, -0.32, -0.55], 0.05);
		beam(mb, [s * 2.4, 1.12, -0.15], [s * 0.58, -0.3, -0.2], 0.04);
	}
	panel(mb, -1.9, 1.9, 2.75, 3.45, 0.62, 0.1, CREAM);
	mb.quad([0, 0.75, 2.4], [0, 0.75, 3.5], [0, 1.45, 3.5], [0, 1.42, 2.75], RED);
	mb.quad([0, 1.42, 2.75], [0, 1.45, 3.5], [0, 1.62, 3.5], [0, 1.6, 2.85], CREAM);
	mb.quad([0, 1.6, 2.85], [0, 1.62, 3.5], [0, 2.15, 3.5], [0, 2.1, 3.05], RED);
	mb.push(mat4Compose(mat4Translate(0, HINGES.prop.y, -3.35), mat4RotateX(-Math.PI / 2)));
	mb.frustum(0, 0, 0, 0.3, 0.5, 0, 8, RED);
	mb.pop();
}

function buildGear(mb) {
	for (const s of [-1, 1]) {
		beam(mb, [s * 0.45, -0.42, -0.55], [s * 1.28, -1.05, -0.55], 0.05);
		wheel(mb, s * 1.32, -1.05, -0.55, 0.3, 0.18);
		mb.blob(s * 1.32, -0.98, -0.6, 0.14, 0.26, 0.46, RED, 3, 6);
	}
	beam(mb, [0, -0.4, -2.55], [0, -1.08, -2.72], 0.05);
	wheel(mb, 0, -1.08, -2.72, 0.27, 0.14);
}

function buildBlades(mb) {
	mb.push(mat4Translate(0, HINGES.prop.y, HINGES.prop.z));
	for (const a of [0, Math.PI]) {
		mb.push(mat4RotateZ(a));
		mb.push(mat4RotateY(0.25)).box(0, 0.5, 0, 0.17, 0.9, 0.04, DARK).pop();
		mb.box(0, 0.98, 0, 0.15, 0.08, 0.05, [0.95, 0.8, 0.2, 0]).pop();
	}
	mb.pop();
}

function buildDisc(mb) {
	const { y, z } = HINGES.prop, p = (i, r) => [Math.cos(i * 0.314) * r, y + Math.sin(i * 0.314) * r, z];
	for (let i = 0; i < 20; i++) {
		mb.tri([0, y, z], p(i, 1.04), p(i + 1, 1.04), [0.55, 0.55, 0.55, 0]);
		mb.tri(p(i, 1.04), p(i, 0.97), p(i + 1, 1.04), [1, 0.85, 0.3, 0.4]);
	}
}

export function buildAircraftMeshes() {
	const surface = (x0, x1, color, zf = -0.08, zt = 0.38, y = 1.22, t = 0.08) => mesh((mb) => panel(mb, x0, x1, zf, zt, y, t, color));
	const z = HINGES.rudder.z;
	return {
		body: mesh(buildBody), gear: mesh(buildGear), blades: mesh(buildBlades), disc: mesh(buildDisc),
		aileronL: surface(-4.9, -2.85, RED), aileronR: surface(2.85, 4.9, RED), flapL: surface(-2.85, -0.7, FLAP), flapR: surface(0.7, 2.85, FLAP),
		elevator: surface(-1.9, 1.9, RED, 3.45, 3.9, 0.62, 0.07),
		rudder: mesh((mb) => {
			mb.quad([0, 0.7, z], [0, 0.7, z + 0.5], [0, 2.0, z + 0.35], [0, 2.15, z], RED);
			mb.quad([0.01, 1.3, z + 0.02], [0.01, 1.3, z + 0.42], [0.01, 1.55, z + 0.38], [0.01, 1.55, z + 0.02], CREAM);
			mb.quad([-0.01, 1.3, z + 0.02], [-0.01, 1.55, z + 0.02], [-0.01, 1.55, z + 0.38], [-0.01, 1.3, z + 0.42], CREAM);
		}),
	};
}
