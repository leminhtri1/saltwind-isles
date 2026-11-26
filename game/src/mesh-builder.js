// CPU builder for flat-shaded meshes (boxes, frustums, ellipsoids, lofts) with RGBA colour, alpha = glow.
import { cross, mat4Identity, mat4Multiply, mat4TransformPoint, normalize, sub } from './math3d.js';

export class MeshBuilder {
	constructor() {
		Object.assign(this, { positions: [], normals: [], colors: [], matrix: mat4Identity(), stack: [] });
	}

	push(m) {
		this.stack.push(this.matrix);
		this.matrix = mat4Multiply(this.matrix, m);
		return this;
	}

	pop() {
		this.matrix = this.stack.pop();
		return this;
	}

	tri(a, b, c, color) {
		const m = this.matrix;
		this.triWorld(mat4TransformPoint(m, a), mat4TransformPoint(m, b), mat4TransformPoint(m, c), color);
	}

	triWorld(pa, pb, pc, color, normal) {
		const n = normal || normalize(cross(sub(pb, pa), sub(pc, pa))), g = color[3] || 0;
		this.positions.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2], pc[0], pc[1], pc[2]);
		for (let i = 0; i < 3; i++) {
			this.normals.push(n[0], n[1], n[2]);
			this.colors.push(color[0], color[1], color[2], g);
		}
	}

	quad(a, b, c, d, color) {
		this.tri(a, b, c, color);
		this.tri(a, c, d, color);
	}

	box(x, y, z, sx, sy, sz, color, topColor = color) {
		const x0 = x - sx / 2, x1 = x + sx / 2, y0 = y - sy / 2, y1 = y + sy / 2, z0 = z - sz / 2, z1 = z + sz / 2;
		this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], topColor); // top
		this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color); // bottom
		this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color); // south (+z)
		this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color); // north (-z)
		this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color); // east
		this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color); // west
		return this;
	}

	frustum(x, y0, z, r0, y1, r1, sides, color, capColor = color) {
		for (let i = 0; i < sides; i++) {
			const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
			const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
			const p0 = [x + c0 * r0, y0, z + s0 * r0], p1 = [x + c1 * r0, y0, z + s1 * r0];
			const q0 = [x + c0 * r1, y1, z + s0 * r1], q1 = [x + c1 * r1, y1, z + s1 * r1];
			if (r1 > 0.0001) this.quad(p0, q0, q1, p1, color);
			else this.tri(p0, q0, p1, color);
			if (r1 > 0.0001) this.tri([x, y1, z], q1, q0, capColor);
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

	loft(sections) {
		const ring = (s) => {
			const pts = [];
			for (let k = 0; k < 8; k++) {
				const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
				pts.push([Math.cos(a) * s.w, s.y + Math.sin(a) * s.h, s.z]);
			}
			return pts;
		};
		const rings = sections.map(ring);
		for (let i = 0; i < sections.length - 1; i++) {
			const A = rings[i], B = rings[i + 1];
			for (let k = 0; k < 8; k++) {
				const k1 = (k + 1) % 8;
				const color = sections[i].colors ? sections[i].colors[k] : sections[i].color;
				this.quad(A[k], A[k1], B[k1], B[k], color);
			}
		}
		const first = rings[0], last = rings[rings.length - 1];
		for (let k = 1; k < 7; k++) {
			this.tri(first[0], first[k + 1], first[k], sections[0].color);
			this.tri(last[0], last[k], last[k + 1], sections[sections.length - 1].color);
		}
		return this;
	}

	build() {
		return {
			positions: new Float32Array(this.positions),
			normals: new Float32Array(this.normals),
			colors: new Float32Array(this.colors),
			count: this.positions.length / 3,
		};
	}
}
