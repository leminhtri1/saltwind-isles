// Airstrip meshes: painted asphalt runway with edge, sequenced-flasher approach and PAPI lights; mown grass strips.
import { mat4Compose, mat4RotateY, mat4Translate, mat4TransformPoint } from './math3d.js';
import { MeshBuilder } from './mesh-builder.js';
import { STRIPS } from './world-layout.js';

const PAINT = [0.93, 0.93, 0.9, 0];

function rect(mb, x0, z0, x1, z1, y, color) {
	mb.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color);
}

function paintRunwayEnd(mb, strip, sign) {
	const t = strip.length / 2, S = (x0, z0, x1, z1) => {
		for (const m of [1, -1]) rect(mb, sign * m * x0, sign * z0, sign * m * x1, sign * z1, 0.02, PAINT);
	};
	for (let k = 0; k < 4; k++) S(2.6 + k * 3.2, t - 36, 4.4 + k * 3.2, t - 6);
	S(4.5, t - 345, 10.5, t - 300);
	for (const d of [150, 450]) for (let k = 0; k < 2; k++) S(5 + k * 2.6, t - d - 22, 6.5 + k * 2.6, t - d);
	for (let z = t - 80; z > 10; z -= 50) rect(mb, -0.45, sign * (z - 30), 0.45, sign * z, 0.02, PAINT);
}

export function buildAirstrips(heightAt) {
	const base = new MeshBuilder(), paint = new MeshBuilder(), props = new MeshBuilder(), lights = [];
	for (const strip of STRIPS) {
		const frame = mat4Compose(mat4Translate(strip.x, strip.elev, strip.z), mat4RotateY(-strip.heading * Math.PI / 180)), L = strip.length, W = strip.width, h = L / 2;
		for (const mb of [base, paint, props]) mb.push(frame);
		const lamp = (x, z, y, s, color, extra) => {
			props.box(x, y - 0.4, z, s, 0.5, s, [...color, 1]);
			lights.push({ pos: mat4TransformPoint(frame, [x, y, z]), color, size: s * 5, ...extra });
		};
		if (strip.surface === 'asphalt') {
			rect(base, -W / 2 - 3, -h - 20, W / 2 + 3, h + 20, 0, [0.3, 0.29, 0.28, 0]);
			rect(base, -W / 2, -h, W / 2, h, 0.01, [0.22, 0.22, 0.24, 0]);
			for (const s of [1, -1]) {
				paintRunwayEnd(paint, strip, s);
				rect(paint, s * (W / 2 - 0.6), -h, s * (W / 2 - 1.4), h, 0.02, PAINT);
				for (let z = -h; z <= h + 0.1; z += 60) lamp(s * (W / 2 + 1.5), z, 0.8, 0.45, [1, 0.9, 0.65]);
				for (let x = -W / 2; x <= W / 2 + 0.1; x += 3) lamp(x, s * (h + 1), 0.7, 0.5, [0.35, 1, 0.45]);
				for (let d = 40; d <= 360; d += 30) {
					const z = s * (h + d), wp = mat4TransformPoint(frame, [0, 0, z]), ground = Math.max(0, heightAt(wp[0], wp[2])) - strip.elev, span = d === 160 ? 15 : 2;
					for (let x = -span; x <= span + 0.1; x += d === 160 ? 3 : 1) {
						props.box(x, (ground + 1.2) / 2, z, 0.25, 1.2 - ground, 0.25, [0.35, 0.33, 0.3, 0]);
						lamp(x, z, 1.5, 0.64, [1, 0.93, 0.75], { rabbit: x === 0 ? (360 - d) / 30 : null });
					}
				}
				for (let k = 0; k < 4; k++) lamp(s * (-W / 2 - 12 - k * 4), s * (h - 300), 1, 0.6, [1, 1, 1], { papi: k + 1 });
			}
		} else {
			for (let z = -h, k = 0; z < h; z += 20, k++) rect(base, -W / 2, z, W / 2, Math.min(h, z + 20), 0.01, k % 2 ? [0.6, 0.72, 0.33, 0] : [0.52, 0.66, 0.28, 0]);
			for (let z = -h; z <= h + 0.1; z += 55) for (const x of [-W / 2 - 1, W / 2 + 1]) props.box(x, 0.35, z, 0.9, 0.7, 0.5, Math.abs(z) > h - 1 ? [0.95, 0.45, 0.15, 0] : [0.95, 0.95, 0.92, 0]);
			for (const s of [1, -1]) for (const x of [-W / 2 - 1, -W / 4, 0, W / 4, W / 2 + 1]) props.box(x, 0.5, s * (h + 2), 2.2, 1, 0.3, [0.98, 0.52, 0.12, 0]);
		}
		for (const mb of [base, paint, props]) mb.pop();
	}
	return { base: base.build(), paint: paint.build(), props: props.build(), lights };
}
