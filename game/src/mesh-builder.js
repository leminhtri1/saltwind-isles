// CPU builder for flat-shaded meshes (boxes, frustums, ellipsoids, lofts) with RGBA colour, alpha = glow.
import { cross, mat4Identity, mat4Multiply, mat4TransformPoint, normalize, sub } from './math3d.js';

export class MeshBuilder {
	positions = [];
	normals = [];
	colors = [];
	matrix = mat4Identity();
	stack = [];

	push(m) {
		this.stack.push(this.matrix);
		this.matrix = mat4Multiply(this.matrix, m);
		return this;
	}

	pop() {
		this.matrix = this.stack.pop();
		return this;
	}

	tri(...pts) {
		const color = pts.pop();
		this.triWorld(...pts.map((p) => mat4TransformPoint(this.matrix, p)), color);
	}

	triWorld(a, b, c, color, n = normalize(cross(sub(b, a), sub(c, a)))) {
		this.positions.push(...a, ...b, ...c);
		for (let i = 0; i < 3; i++) {
			this.normals.push(...n);
			this.colors.push(color[0], color[1], color[2], color[3] || 0);
		}
	}

	quad(a, b, c, d, color) {
		this.tri(a, b, c, color);
		this.tri(a, c, d, color);
	}

	box(x, y, z, sx, sy, sz, color, topColor = color) {
		const X = [x - sx / 2, x + sx / 2], Y = [y - sy / 2, y + sy / 2], Z = [z - sz / 2, z + sz / 2], p = (i, j, k) => [X[i], Y[j], Z[k]];
		this.quad(p(0, 1, 1), p(1, 1, 1), p(1, 1, 0), p(0, 1, 0), topColor);
		for (const f of [[0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1], [0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1], [1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0], [1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1], [0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0]]) {
			this.quad(p(f[0], f[1], f[2]), p(f[3], f[4], f[5]), p(f[6], f[7], f[8]), p(f[9], f[10], f[11]), color);
		}
		return this;
	}

	frustum(x, y0, z, r0, y1, r1, sides, color, capColor = color) {
		const at = (i, r, y) => [x + Math.cos(i / sides * 6.2832) * r, y, z + Math.sin(i / sides * 6.2832) * r];
		for (let i = 0; i < sides; i++) {
			const p0 = at(i, r0, y0), p1 = at(i + 1, r0, y0), q0 = at(i, r1, y1), q1 = at(i + 1, r1, y1);
			if (r1 > 0.0001) {
				this.quad(p0, q0, q1, p1, color);
				this.tri([x, y1, z], q1, q0, capColor);
			} else this.tri(p0, q0, p1, color);
			if (r0 > 0.0001) this.tri([x, y0, z], p0, p1, capColor);
		}
		return this;
	}

	blob(x, y, z, rx, ry, rz, color, rings = 4, sides = 7, bottomColor = color) {
		const pt = (i, j) => {
			const v = (i / rings) * Math.PI, u = (j / sides) * Math.PI * 2;
			return [x + Math.sin(v) * Math.cos(u) * rx, y + Math.cos(v) * ry, z + Math.sin(v) * Math.sin(u) * rz];
		};
		for (let i = 0; i < rings; i++) {
			const c = i >= rings / 2 ? bottomColor : color;
			for (let j = 0; j < sides; j++) {
				const a = pt(i, j), b = pt(i, j + 1), cc = pt(i + 1, j + 1), d = pt(i + 1, j);
				if (i === 0) this.tri(a, cc, d, c);
				else if (i === rings - 1) this.tri(a, b, d, c);
				else this.quad(a, b, cc, d, c);
			}
		}
		return this;
	}

	loft(sections, n = 8) {
		const rings = sections.map((s) => [...Array(n)].map((_, k) => [Math.cos((k + 0.5) * 6.2832 / n) * s.w, s.y + Math.sin((k + 0.5) * 6.2832 / n) * s.h, s.z]));
		rings.forEach((A, i) => {
			const B = rings[i + 1], s = sections[i];
			if (B) for (let k = 0; k < n; k++) this.quad(A[k], A[(k + 1) % n], B[(k + 1) % n], B[k], s.colors ? s.colors[k] : s.color);
		});
		const first = rings[0], last = rings[rings.length - 1];
		for (let k = 1; k < n - 1; k++) {
			this.tri(first[0], first[k + 1], first[k], sections[0].color);
			this.tri(last[0], last[k], last[k + 1], sections[sections.length - 1].color);
		}
		return this;
	}

	build() {
		const f = (a) => new Float32Array(a);
		return { positions: f(this.positions), normals: f(this.normals), colors: f(this.colors), count: this.positions.length / 3 };
	}
}

export function meshOf(draw) {
	const mb = new MeshBuilder();
	draw(mb);
	return mb.build();
}
