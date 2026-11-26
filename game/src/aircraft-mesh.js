// The Kittiwake bush plane: lofted fuselage, strut-braced high wing, moving surfaces, spatted gear, propeller.
import { cross, mat4Compose, mat4RotateX, mat4RotateY, mat4RotateZ, mat4Translate, normalize, sub } from './math3d.js';
import { MeshBuilder } from './mesh-builder.js';

const CREAM = [0.98, 0.94, 0.84, 0];
const RED = [0.78, 0.07, 0.06, 0];
const TEAL = [0.08, 0.16, 0.24, 0];
const GLASS = [0.1, 0.16, 0.22, 0.05];
const DARK = [0.13, 0.13, 0.14, 0];
const METAL = [0.6, 0.62, 0.64, 0];
const TIRE = [0.08, 0.08, 0.09, 0];

export const GEAR_HEIGHT = 1.35;

export const HINGES = {
	wingTrailing: { y: 1.2, z: -0.08 },
	elevator: { y: 0.62, z: 3.45 },
	rudder: { z: 3.5 },
	prop: { y: 0.05, z: -3.5 },
};

export const NAV_LIGHTS = [
	{ p: [-5.62, 1.22, -0.7], c: [1, 0.12, 0.08] }, { p: [5.62, 1.22, -0.7], c: [0.1, 1, 0.3] },
	{ p: [0, 0.66, 4.0], c: [1, 1, 1] }, { p: [0, 2.2, 3.3], c: [1, 0.2, 0.1], flash: true },
];

function beam(mb, a, b, w, color) {
	const d = normalize(sub(b, a));
	let u = normalize(cross(d, [0, 0, 1]));
	if (!u[0] && !u[1] && !u[2]) u = [1, 0, 0];
	const v = cross(d, u);
	const corner = (p, k) => {
		const c = Math.cos(k * Math.PI / 2) * w, s = Math.sin(k * Math.PI / 2) * w;
		return [p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s];
	};
	for (let k = 0; k < 4; k++) mb.quad(corner(a, k), corner(a, k + 1), corner(b, k + 1), corner(b, k), color);
}

function wheel(mb, x, y, z, r, w) {
	mb.push(mat4Compose(mat4Translate(x, y, z), mat4RotateZ(Math.PI / 2)));
	mb.frustum(0, -w / 2, 0, r, w / 2, r, 10, TIRE, [0.5, 0.5, 0.52, 0]);
	mb.pop();
}

function panel(mb, x0, x1, zf, zt, y, t, top, bottom = top) {
	const yb = y - t / 2, yt = y + t / 2, zm = zf + (zt - zf) * 0.3;
	mb.quad([x0, yt, zm], [x1, yt, zm], [x1, yt - t * 0.2, zf], [x0, yt - t * 0.2, zf], top);
	mb.quad([x0, y + t * 0.1, zt], [x1, y + t * 0.1, zt], [x1, yt, zm], [x0, yt, zm], top);
	mb.quad([x0, yt - t * 0.2, zf], [x1, yt - t * 0.2, zf], [x1, yb, zm], [x0, yb, zm], bottom);
	mb.quad([x0, yb, zm], [x1, yb, zm], [x1, y + t * 0.1, zt], [x0, y + t * 0.1, zt], bottom);
	for (const [x, s] of [[x0, -1], [x1, 1]]) {
		const pts = [[x, yt - t * 0.2, zf], [x, yt, zm], [x, y + t * 0.1, zt], [x, yb, zm]];
		if (s > 0) { mb.tri(pts[0], pts[1], pts[2], top); mb.tri(pts[0], pts[2], pts[3], top); }
		else { mb.tri(pts[0], pts[2], pts[1], top); mb.tri(pts[0], pts[3], pts[2], top); }
	}
}

function buildBody() {
	const mb = new MeshBuilder();
	const side = (glass) => [CREAM, RED, RED, CREAM, RED, RED, RED, RED].map((c, k) => (glass && (k === 0 || k === 3) ? GLASS : c));
	const front = (k) => (k === 1 || k === 2 ? GLASS : k === 4 || k === 7 ? RED : k === 5 || k === 6 ? TEAL : CREAM);
	mb.loft([
		{ z: -3.35, w: 0.42, h: 0.42, y: 0.05, color: RED },
		{ z: -2.6, w: 0.56, h: 0.56, y: 0.08, color: RED },
		{ z: -1.7, w: 0.62, h: 0.7, y: 0.2, color: CREAM, colors: [0, 1, 2, 3, 4, 5, 6, 7].map(front) },
		{ z: -1.0, w: 0.64, h: 0.84, y: 0.3, color: CREAM, colors: side(true) },
		{ z: 0.1, w: 0.63, h: 0.82, y: 0.3, color: CREAM, colors: side(true) },
		{ z: 0.5, w: 0.62, h: 0.8, y: 0.3, color: CREAM, colors: side(false) },
		{ z: 1.7, w: 0.42, h: 0.52, y: 0.38, color: CREAM, colors: side(false) },
		{ z: 3.3, w: 0.18, h: 0.26, y: 0.58, color: CREAM, colors: side(false) },
		{ z: 3.95, w: 0.08, h: 0.14, y: 0.62, color: RED },
	]);
	for (const s of [-1, 1]) mb.box(s * 0.45, -0.38, -2.3, 0.1, 0.1, 0.5, DARK);
	for (let k = 0; k < 4; k++) mb.box(0, 0.63, -2.75 + k * 0.17, 0.42, 0.03, 0.06, DARK);
	mb.box(0, -0.5, -2.65, 0.36, 0.14, 0.4, DARK);
	for (const s of [-1, 1]) {
		mb.box(s * 0.63, 0.32, -0.42, 0.02, 0.9, 0.025, DARK);
		mb.box(s * 0.63, 0.32, -1.02, 0.02, 0.9, 0.025, DARK);
		mb.box(s * 0.7, -0.45, -0.75, 0.25, 0.04, 0.16, METAL);
	}
	const wy = 1.22;
	const UNDER = [0.84, 0.8, 0.72, 0];
	panel(mb, -5.6, -4.5, -1.35, -0.08, wy, 0.2, RED);
	panel(mb, -4.5, -4.2, -1.35, -0.08, wy, 0.2, CREAM, UNDER);
	panel(mb, -4.2, -3.9, -1.35, -0.08, wy, 0.2, RED);
	panel(mb, -3.9, 3.9, -1.35, -0.08, wy, 0.2, CREAM, UNDER);
	panel(mb, 3.9, 4.2, -1.35, -0.08, wy, 0.2, RED);
	panel(mb, 4.2, 4.5, -1.35, -0.08, wy, 0.2, CREAM, UNDER);
	panel(mb, 4.5, 5.6, -1.35, -0.08, wy, 0.2, RED);
	mb.box(0, wy + 0.06, -0.7, 1.3, 0.1, 1.1, CREAM);
	for (const s of [-1, 1]) mb.box(s * 1.6, wy + 0.11, -0.8, 0.14, 0.03, 0.14, DARK);
	panel(mb, -0.7, 0.7, -0.08, 0.35, wy, 0.08, CREAM);
	beam(mb, [2.6, wy - 0.1, -0.55], [0.58, -0.32, -0.55], 0.05, METAL);
	beam(mb, [-2.6, wy - 0.1, -0.55], [-0.58, -0.32, -0.55], 0.05, METAL);
	beam(mb, [2.4, wy - 0.1, -0.15], [0.58, -0.3, -0.2], 0.04, METAL);
	beam(mb, [-2.4, wy - 0.1, -0.15], [-0.58, -0.3, -0.2], 0.04, METAL);
	panel(mb, -1.9, 1.9, 2.75, 3.45, 0.62, 0.1, CREAM);
	for (const x of [0.012, -0.012]) {
		const q = x > 0 ? (a, b, c, d, col) => mb.quad(a, b, c, d, col) : (a, b, c, d, col) => mb.quad(a, d, c, b, col);
		q([x, 0.75, 2.4], [x, 0.75, 3.5], [x, 1.45, 3.5], [x, 1.42, 2.75], RED);
		q([x, 1.42, 2.75], [x, 1.45, 3.5], [x, 1.62, 3.5], [x, 1.6, 2.85], CREAM);
		q([x, 1.6, 2.85], [x, 1.62, 3.5], [x, 2.15, 3.5], [x, 2.1, 3.05], RED);
	}
	mb.push(mat4Compose(mat4Translate(0, HINGES.prop.y, -3.35), mat4RotateX(-Math.PI / 2)));
	mb.frustum(0, 0, 0, 0.3, 0.5, 0, 8, RED);
	mb.pop();
	return mb.build();
}

function buildGear() {
	const mb = new MeshBuilder();
	for (const s of [-1, 1]) {
		beam(mb, [s * 0.45, -0.42, -0.55], [s * 1.28, -1.05, -0.55], 0.05, METAL);
		wheel(mb, s * 1.32, -1.05, -0.55, 0.3, 0.18);
		mb.blob(s * 1.32, -0.98, -0.6, 0.14, 0.26, 0.46, RED, 3, 6);
	}
	beam(mb, [0, -0.4, -2.55], [0, -1.08, -2.72], 0.05, METAL);
	wheel(mb, 0, -1.08, -2.72, 0.27, 0.14);
	return mb.build();
}

function buildSurface(x0, x1, zf, zt, y, t, color) {
	const mb = new MeshBuilder();
	panel(mb, x0, x1, zf, zt, y, t, color);
	return mb.build();
}

function buildRudder() {
	const mb = new MeshBuilder();
	const z0 = HINGES.rudder.z;
	mb.quad([0.02, 0.7, z0], [0.02, 0.7, z0 + 0.5], [0.02, 2.0, z0 + 0.35], [0.02, 2.15, z0], RED);
	mb.quad([-0.02, 0.7, z0], [-0.02, 2.15, z0], [-0.02, 2.0, z0 + 0.35], [-0.02, 0.7, z0 + 0.5], RED);
	mb.quad([0.03, 1.3, z0 + 0.02], [0.03, 1.3, z0 + 0.42], [0.03, 1.55, z0 + 0.38], [0.03, 1.55, z0 + 0.02], CREAM);
	mb.quad([-0.03, 1.3, z0 + 0.02], [-0.03, 1.55, z0 + 0.02], [-0.03, 1.55, z0 + 0.38], [-0.03, 1.3, z0 + 0.42], CREAM);
	return mb.build();
}

function buildBlades() {
	const mb = new MeshBuilder();
	mb.push(mat4Translate(0, HINGES.prop.y, HINGES.prop.z));
	for (const s of [1, -1]) {
		mb.push(mat4RotateZ(s > 0 ? 0 : Math.PI));
		mb.push(mat4RotateY(0.25));
		mb.box(0, 0.5, 0, 0.17, 0.9, 0.04, DARK);
		mb.pop();
		mb.box(0, 0.98, 0, 0.15, 0.08, 0.05, [0.95, 0.8, 0.2, 0]);
		mb.pop();
	}
	mb.pop();
	return mb.build();
}

function buildDisc() {
	const mb = new MeshBuilder();
	const n = 20, r = 1.04, y = HINGES.prop.y, z = HINGES.prop.z;
	for (let i = 0; i < n; i++) {
		const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
		mb.tri([0, y, z], [Math.cos(a0) * r, y + Math.sin(a0) * r, z], [Math.cos(a1) * r, y + Math.sin(a1) * r, z], [0.55, 0.55, 0.55, 0]);
		mb.tri([Math.cos(a0) * r, y + Math.sin(a0) * r, z], [Math.cos(a0) * r * 0.93, y + Math.sin(a0) * r * 0.93, z], [Math.cos(a1) * r, y + Math.sin(a1) * r, z], [1, 0.85, 0.3, 0.4]);
	}
	return mb.build();
}

export function buildAircraftMeshes() {
	const wy = 1.22, zf = -0.08, zt = 0.38;
	return {
		body: buildBody(),
		gear: buildGear(),
		aileronL: buildSurface(-4.9, -2.85, zf, zt, wy, 0.08, RED),
		aileronR: buildSurface(2.85, 4.9, zf, zt, wy, 0.08, RED),
		flapL: buildSurface(-2.85, -0.7, zf, zt, wy, 0.08, [0.9, 0.86, 0.75, 0]),
		flapR: buildSurface(0.7, 2.85, zf, zt, wy, 0.08, [0.9, 0.86, 0.75, 0]),
		elevator: buildSurface(-1.9, 1.9, 3.45, 3.9, 0.62, 0.07, RED),
		rudder: buildRudder(),
		blades: buildBlades(),
		disc: buildDisc(),
	};
}
