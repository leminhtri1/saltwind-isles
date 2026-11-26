// Vectors, quaternions and column-major 4x4 matrices. +X east, +Y up, +Z south; a body's nose is local -Z.

export const DEG = Math.PI / 180;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
	const t = clamp((x - e0) / (e1 - e0), 0, 1);
	return t * t * (3 - 2 * t);
};
export const damp = (k, dt) => 1 - Math.exp(-k * dt);

export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const scale = (a, s) => a.map((v) => v * s);
export const madd = (a, b, s) => a.map((v, i) => v + b[i] * s);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
export const normalize = (a, l = length(a)) => (l > 1e-9 ? scale(a, 1 / l) : [0, 0, 0]);

export const quatAxisAngle = (axis, angle) => [...scale(axis, Math.sin(angle / 2)), Math.cos(angle / 2)];
export const quatMul = (a, b) => [
	a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
	a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
	a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
	a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const quatNormalize = (q) => scale(q, 1 / (Math.hypot(...q) || 1));
export function quatRotate([x, y, z, w], v) {
	const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
	return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
export const quatFromAttitude = (heading, pitch, bank) => quatNormalize(quatMul(quatMul(quatAxisAngle([0, 1, 0], -heading), quatAxisAngle([1, 0, 0], pitch)), quatAxisAngle([0, 0, 1], -bank)));
export function attitudeOf(q) {
	const f = quatRotate(q, [0, 0, -1]), r = quatRotate(q, [1, 0, 0]), u = quatRotate(q, [0, 1, 0]), heading = Math.atan2(f[0], -f[2]);
	return { heading: heading < 0 ? heading + Math.PI * 2 : heading, pitch: Math.asin(clamp(f[1], -1, 1)), bank: Math.atan2(-r[1], u[1]) };
}

const mat = (entries, base = 1) => Object.assign(new Float32Array(16).fill(0).map((_, i) => (base && i % 5 === 0 ? 1 : 0)), entries);
export const mat4Identity = () => mat({});
export function mat4Multiply(a, b) {
	const o = new Float32Array(16);
	for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
	return o;
}
export function mat4Perspective(fovy, aspect, near, far) {
	const f = 1 / Math.tan(fovy / 2);
	return mat({ 0: f / aspect, 5: f, 10: (far + near) / (near - far), 11: -1, 14: (2 * far * near) / (near - far) }, 0);
}
export function mat4LookAt(eye, target, up) {
	const z = normalize(sub(eye, target)), x = normalize(cross(up, z)), y = cross(z, x);
	return mat({ 0: x[0], 4: x[1], 8: x[2], 1: y[0], 5: y[1], 9: y[2], 2: z[0], 6: z[1], 10: z[2], 12: -dot(x, eye), 13: -dot(y, eye), 14: -dot(z, eye) });
}
export function mat4FromQuatPos([x, y, z, w], p) {
	return mat({
		0: 1 - 2 * (y * y + z * z), 1: 2 * (x * y + z * w), 2: 2 * (x * z - y * w), 4: 2 * (x * y - z * w), 5: 1 - 2 * (x * x + z * z), 6: 2 * (y * z + x * w),
		8: 2 * (x * z + y * w), 9: 2 * (y * z - x * w), 10: 1 - 2 * (x * x + y * y), 12: p[0], 13: p[1], 14: p[2],
	});
}
export const mat4Translate = (x, y, z) => mat({ 12: x, 13: y, 14: z });
export const mat4Scale = (x, y, z) => mat({ 0: x, 5: y, 10: z });
const rot = (a, i, j) => {
	const c = Math.cos(a), s = Math.sin(a);
	return mat({ [i * 5]: c, [i * 4 + j]: s, [j * 4 + i]: -s, [j * 5]: c });
};
export const mat4RotateX = (a) => rot(a, 1, 2);
export const mat4RotateY = (a) => rot(a, 2, 0);
export const mat4RotateZ = (a) => rot(a, 0, 1);
export const mat4Compose = (...ms) => ms.reduce(mat4Multiply);
export const mat4TransformPoint = (m, p) => [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
export function projectToScreen(m, p, width, height) {
	const [x, y, , w] = [0, 1, 2, 3].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
	return w <= 0.01 ? null : { x: (x / w * 0.5 + 0.5) * width, y: (0.5 - y / w * 0.5) * height, depth: w };
}
