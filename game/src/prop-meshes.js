// Mission and airfield props: supply crate, parachute, drop-zone mark and windsock.
import { mat4Compose, mat4RotateX, mat4Translate } from './math3d.js';
import { meshOf } from './mesh-builder.js';

export const buildCrate = () => meshOf((mb) => mb.box(0, 0, 0, 1.4, 1.1, 1.4, [0.62, 0.42, 0.22, 0]).box(0, 0, 0, 1.46, 0.2, 1.46, [0.85, 0.2, 0.15, 0]));

export const buildChute = () => meshOf((mb) => {
	mb.blob(0, 6, 0, 3.6, 1.8, 3.6, [0.98, 0.5, 0.16, 0.15], 4, 8, [0.95, 0.92, 0.85, 0.1]);
	for (const [x, z] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]]) mb.box(x, 3, z, 0.06, 5.2, 0.06, [0.9, 0.9, 0.9, 0]);
});

export const buildTargetMarker = () => meshOf((mb) => {
	for (let k = 0; k < 4; k++) {
		const r0 = [0, 6, 14, 20][k], r1 = [6, 14, 20, 26][k], c = k % 2 ? [0.97, 0.95, 0.9, 0.4] : [1, 0.5, 0.15, 0.6], p = (r, i) => [Math.cos(i * 0.2618) * r, 0, Math.sin(i * 0.2618) * r];
		for (let i = 0; i < 24; i++) mb.quad(p(r0, i), p(r1, i), p(r1, i + 1), p(r0, i + 1), c);
	}
});

export const buildWindsock = () => meshOf((mb) => {
	mb.box(0, 4, 0, 0.18, 8, 0.18, [0.8, 0.8, 0.8, 0]).push(mat4Compose(mat4Translate(0, 7.8, 0), mat4RotateX(-Math.PI / 2)));
	for (let k = 0; k < 4; k++) mb.frustum(0, k * 0.9, 0, 0.55 - k * 0.08, (k + 1) * 0.9, 0.47 - k * 0.08, 8, k % 2 ? [0.96, 0.95, 0.92, 0] : [1, 0.45, 0.1, 0]);
});
