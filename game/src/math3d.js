// Vectors, quaternions and column-major 4x4 matrices. +X east, +Y up, +Z south; a body's nose is local -Z.

export const DEG = Math.PI / 180;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
	const t = clamp((x - e0) / (e1 - e0), 0, 1);
	return t * t * (3 - 2 * t);
};
export const damp = (k, dt) => 1 - Math.exp(-k * dt);

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const madd = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export function normalize(a) {
	const l = length(a);
	return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}

export function quatAxisAngle(axis, angle) {
	const s = Math.sin(angle / 2);
	return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}
export function quatMul(a, b) {
	return [
		a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
		a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
		a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
		a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
	];
}
export function quatNormalize(q) {
	const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
	return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
export function quatRotate(q, v) {
	const [x, y, z, w] = q;
	const tx = 2 * (y * v[2] - z * v[1]);
	const ty = 2 * (z * v[0] - x * v[2]);
	const tz = 2 * (x * v[1] - y * v[0]);
	return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
export function quatFromAttitude(heading, pitch, bank) {
	const qy = quatAxisAngle([0, 1, 0], -heading);
	const qp = quatAxisAngle([1, 0, 0], pitch);
	const qr = quatAxisAngle([0, 0, 1], -bank);
	return quatNormalize(quatMul(quatMul(qy, qp), qr));
}
export function attitudeOf(q) {
	const f = quatRotate(q, [0, 0, -1]);
	const r = quatRotate(q, [1, 0, 0]);
	const u = quatRotate(q, [0, 1, 0]);
	let heading = Math.atan2(f[0], -f[2]);
	if (heading < 0) heading += Math.PI * 2;
	return { heading, pitch: Math.asin(clamp(f[1], -1, 1)), bank: Math.atan2(-r[1], u[1]) };
}

export function mat4Identity() {
	const m = new Float32Array(16);
	m[0] = m[5] = m[10] = m[15] = 1;
	return m;
}
export function mat4Multiply(a, b) {
	const o = new Float32Array(16);
	for (let c = 0; c < 4; c++) {
		for (let r = 0; r < 4; r++) {
			o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
		}
	}
	return o;
}
export function mat4Perspective(fovy, aspect, near, far) {
	const f = 1 / Math.tan(fovy / 2);
	const m = new Float32Array(16);
	m[0] = f / aspect;
	m[5] = f;
	m[10] = (far + near) / (near - far);
	m[11] = -1;
	m[14] = (2 * far * near) / (near - far);
	return m;
}
export function mat4LookAt(eye, target, up) {
	const z = normalize(sub(eye, target));
	const x = normalize(cross(up, z));
	const y = cross(z, x);
	const m = new Float32Array(16);
	m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
	m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
	m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
	m[12] = -dot(x, eye); m[13] = -dot(y, eye); m[14] = -dot(z, eye);
	m[15] = 1;
	return m;
}
export function mat4FromQuatPos(q, p, s = 1) {
	const [x, y, z, w] = q;
	const m = new Float32Array(16);
	m[0] = (1 - 2 * (y * y + z * z)) * s; m[1] = 2 * (x * y + z * w) * s; m[2] = 2 * (x * z - y * w) * s;
	m[4] = 2 * (x * y - z * w) * s; m[5] = (1 - 2 * (x * x + z * z)) * s; m[6] = 2 * (y * z + x * w) * s;
	m[8] = 2 * (x * z + y * w) * s; m[9] = 2 * (y * z - x * w) * s; m[10] = (1 - 2 * (x * x + y * y)) * s;
	m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1;
	return m;
}
export function mat4Translate(x, y, z) {
	const m = mat4Identity();
	m[12] = x; m[13] = y; m[14] = z;
	return m;
}
export function mat4Scale(x, y, z) {
	const m = mat4Identity();
	m[0] = x; m[5] = y; m[10] = z;
	return m;
}
export function mat4RotateX(a) {
	const m = mat4Identity(), c = Math.cos(a), s = Math.sin(a);
	m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
	return m;
}
export function mat4RotateY(a) {
	const m = mat4Identity(), c = Math.cos(a), s = Math.sin(a);
	m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
	return m;
}
export function mat4RotateZ(a) {
	const m = mat4Identity(), c = Math.cos(a), s = Math.sin(a);
	m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
	return m;
}
export function mat4Compose(...ms) {
	return ms.reduce((acc, m) => mat4Multiply(acc, m));
}
export function mat4TransformPoint(m, p) {
	return [
		m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
		m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
		m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
	];
}
export function projectToScreen(viewProj, p, width, height) {
	const x = viewProj[0] * p[0] + viewProj[4] * p[1] + viewProj[8] * p[2] + viewProj[12];
	const y = viewProj[1] * p[0] + viewProj[5] * p[1] + viewProj[9] * p[2] + viewProj[13];
	const w = viewProj[3] * p[0] + viewProj[7] * p[1] + viewProj[11] * p[2] + viewProj[15];
	if (w <= 0.01) return null;
	return { x: (x / w * 0.5 + 0.5) * width, y: (1 - (y / w * 0.5 + 0.5)) * height, depth: w };
}
