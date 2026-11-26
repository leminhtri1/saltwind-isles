// Mission and airfield props: supply crate, parachute, drop-zone mark and windsock.
import { mat4Compose, mat4RotateX, mat4Translate } from './math3d.js';
import { MeshBuilder } from './mesh-builder.js';

export function buildCrate() {
	const mb = new MeshBuilder();
	mb.box(0, 0, 0, 1.4, 1.1, 1.4, [0.62, 0.42, 0.22, 0]);
	mb.box(0, 0, 0, 1.46, 0.2, 1.46, [0.85, 0.2, 0.15, 0]);
	return mb.build();
}

export function buildChute() {
	const mb = new MeshBuilder();
	mb.blob(0, 6, 0, 3.6, 1.8, 3.6, [0.98, 0.5, 0.16, 0.15], 4, 8, [0.95, 0.92, 0.85, 0.1]);
	for (const [x, z] of [[2.8, 0], [-2.8, 0], [0, 2.8], [0, -2.8]]) mb.box(x / 2, 3, z / 2, 0.06, 5.2, 0.06, [0.9, 0.9, 0.9, 0]);
	return mb.build();
}

export function buildTargetMarker() {
	const mb = new MeshBuilder();
	const ring = (r0, r1, color) => {
		for (let i = 0; i < 24; i++) {
			const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
			const p = (r, a) => [Math.cos(a) * r, 0, Math.sin(a) * r];
			mb.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1), color);
		}
	};
	ring(0, 6, [1, 0.5, 0.15, 0.6]);
	ring(6, 14, [0.97, 0.95, 0.9, 0.4]);
	ring(14, 20, [1, 0.5, 0.15, 0.6]);
	ring(20, 26, [0.97, 0.95, 0.9, 0.4]);
	return mb.build();
}

export function buildWindsock() {
	const mb = new MeshBuilder();
	mb.box(0, 4, 0, 0.18, 8, 0.18, [0.8, 0.8, 0.8, 0]);
	mb.push(mat4Compose(mat4Translate(0, 7.8, 0), mat4RotateX(-Math.PI / 2)));
	for (let k = 0; k < 4; k++) mb.frustum(0, k * 0.9, 0, 0.55 - k * 0.08, (k + 1) * 0.9, 0.55 - (k + 1) * 0.08, 8, k % 2 ? [0.96, 0.95, 0.92, 0] : [1, 0.45, 0.1, 0]);
	mb.pop();
	return mb.build();
}
