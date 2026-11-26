// Raw WebGL2 renderer: shader programs, vertex arrays, sky, lit meshes, sea and sprite batches.
import { mat4Multiply } from './math3d.js';
import { LIT_FS, LIT_VS, SKY_FS, SKY_VS, SPRITE_FS, SPRITE_VS, WATER_FS, WATER_VS } from './shaders.js';

function createProgram(gl, vs, fs) {
	const p = gl.createProgram(), cache = new Map();
	for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
		const sh = gl.createShader(type);
		gl.shaderSource(sh, src);
		gl.compileShader(sh);
		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(sh));
		gl.attachShader(p, sh);
	}
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
	return { p, loc: (name) => (cache.has(name) ? cache : cache.set(name, gl.getUniformLocation(p, name))).get(name) };
}

export class SpriteBatch {
	data = [];
	clear() { this.data.length = 0; }
	get count() { return this.data.length / 9; }
	quad(p0, p1, p2, p3, c) {
		for (const [p, u, w] of [[p0, 0, 0], [p1, 1, 0], [p2, 1, 1], [p0, 0, 0], [p2, 1, 1], [p3, 0, 1]]) this.data.push(...p, u, w, ...c);
	}
	billboard(pos, size, color, right, up) {
		const p = (sr, su) => pos.map((v, i) => v + (right[i] * sr + up[i] * su) * size);
		this.quad(p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), color);
	}
}

export class GLRenderer {
	constructor(canvas) {
		const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true, alpha: false });
		if (!gl) throw new Error('WebGL2 is not available');
		const buf = gl.createBuffer();
		Object.assign(this, {
			gl, canvas, spriteBuf: buf, lit: createProgram(gl, LIT_VS, LIT_FS), sky: createProgram(gl, SKY_VS, SKY_FS),
			water: createProgram(gl, WATER_VS, WATER_FS), sprite: createProgram(gl, SPRITE_VS, SPRITE_FS),
		});
		this.skyVao = this.vertexArray([[new Float32Array([-1, -1, 3, -1, -1, 3]), 2]]);
		this.spriteVao = this.vertexArray([[buf, 3, 36, 0], [buf, 2, 36, 12], [buf, 4, 36, 20]]);
	}

	resize(width, height) {
		if (this.canvas.width !== width || this.canvas.height !== height) Object.assign(this.canvas, { width, height });
	}

	vertexArray(attrs, indices) {
		const gl = this.gl, vao = gl.createVertexArray();
		gl.bindVertexArray(vao);
		attrs.forEach(([src, size, stride = 0, offset = 0], i) => {
			const own = !(src instanceof WebGLBuffer);
			gl.bindBuffer(gl.ARRAY_BUFFER, own ? gl.createBuffer() : src);
			if (own) gl.bufferData(gl.ARRAY_BUFFER, src, gl.STATIC_DRAW);
			gl.enableVertexAttribArray(i);
			gl.vertexAttribPointer(i, size, gl.FLOAT, false, stride, offset);
		});
		if (indices) {
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
		}
		gl.bindVertexArray(null);
		return vao;
	}

	uploadMesh(d) {
		return { vao: this.vertexArray([[d.positions, 3], [d.normals, 3], [d.colors, 4]]), count: d.count };
	}

	uploadWater(d) {
		return { vao: this.vertexArray([[d.positions, 3], [d.depths, 1]], d.indices), count: d.indices.length };
	}

	beginFrame({ view, proj, camPos, sunDir, time, fogDensity, clouds }) {
		const gl = this.gl, viewProj = mat4Multiply(proj, view);
		const basis = [view[0], view[4], view[8], view[1], view[5], view[9], -view[2], -view[6], -view[10]];
		this.shared = { uViewProj: viewProj, uCamPos: camPos, uSunDir: sunDir, uTime: time, uFogDensity: fogDensity, uClouds: clouds, uCamBasis: basis, uLens: [1 / proj[0], 1 / proj[5]], uRight: basis.slice(0, 3), uUp: basis.slice(3, 6) };
		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		return viewProj;
	}

	use(prog, own) {
		const gl = this.gl;
		gl.useProgram(prog.p);
		for (const [name, v] of Object.entries({ ...this.shared, ...own })) {
			const l = prog.loc(name), n = v.length;
			if (!l) continue;
			if (n === 16) gl.uniformMatrix4fv(l, false, v);
			else if (n === 9) gl.uniformMatrix3fv(l, false, v);
			else if (n) gl[`uniform${Math.min(n, 4)}fv`](l, v);
			else gl.uniform1f(l, +v);
		}
	}

	draw(vao, count, indexed) {
		this.gl.bindVertexArray(vao);
		if (indexed) this.gl.drawElements(this.gl.TRIANGLES, count, this.gl.UNSIGNED_INT, 0);
		else this.gl.drawArrays(this.gl.TRIANGLES, 0, count);
	}

	drawSky() {
		const gl = this.gl;
		this.use(this.sky);
		gl.disable(gl.DEPTH_TEST);
		this.draw(this.skyVao, 3);
		gl.enable(gl.DEPTH_TEST);
	}

	drawMesh(mesh, model, { alpha = 1, tint = [1, 1, 1], decal = 0, ground = false } = {}) {
		const gl = this.gl;
		this.use(this.lit, { uModel: model, uAlpha: alpha, uTint: tint, uGround: ground });
		this.blend(alpha < 1 && gl.ONE_MINUS_SRC_ALPHA);
		gl[decal ? 'enable' : 'disable'](gl.POLYGON_OFFSET_FILL);
		gl.polygonOffset(-decal, -decal * 2);
		this.draw(mesh.vao, mesh.count);
		this.blend(false);
	}

	drawWater(mesh) {
		this.use(this.water);
		this.draw(mesh.vao, mesh.count, true);
	}

	blend(dst) {
		const gl = this.gl;
		gl[dst ? 'enable' : 'disable'](gl.BLEND);
		gl.depthMask(!dst);
		if (dst) gl.blendFunc(gl.SRC_ALPHA, dst);
	}

	drawSprites(batch, { additive = false, softness = 1.5, fogged = false, cloud = false } = {}) {
		if (!batch.count) return;
		const gl = this.gl;
		this.use(this.sprite, { uSoftness: softness, uFogged: fogged, uCloud: cloud });
		gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.data), gl.DYNAMIC_DRAW);
		this.blend(additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
		this.draw(this.spriteVao, batch.count);
		this.blend(false);
	}
}
