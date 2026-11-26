// A small raw-WebGL2 renderer: compiles the shader programs, uploads meshes into vertex arrays and
// draws the sky, lit meshes, the sea and batches of camera-facing sprites (glows, smoke, shadows).
import { mat4Multiply } from './math3d.js';
import { LIT_FS, LIT_VS, SKY_FS, SKY_VS, SPRITE_FS, SPRITE_VS, WATER_FS, WATER_VS } from './shaders.js';

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(sh));
  return sh;
}

function createProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
  const cache = new Map();
  const loc = (name) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
    return cache.get(name);
  };
  return { p, loc };
}

/** Collects camera-facing quads and arbitrary flat quads into one dynamic vertex buffer. */
export class SpriteBatch {
  constructor() { this.data = []; }
  clear() { this.data.length = 0; }
  get count() { return this.data.length / 9; }
  quad(p0, p1, p2, p3, color) {
    const c = color, v = (p, u, w) => this.data.push(p[0], p[1], p[2], u, w, c[0], c[1], c[2], c[3]);
    v(p0, 0, 0); v(p1, 1, 0); v(p2, 1, 1);
    v(p0, 0, 0); v(p2, 1, 1); v(p3, 0, 1);
  }
  billboard(pos, size, color, right, up) {
    const r = [right[0] * size, right[1] * size, right[2] * size], u = [up[0] * size, up[1] * size, up[2] * size];
    const p = (sr, su) => [pos[0] + r[0] * sr + u[0] * su, pos[1] + r[1] * sr + u[1] * su, pos[2] + r[2] * sr + u[2] * su];
    this.quad(p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), color);
  }
}

export class GLRenderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.canvas = canvas;
    this.lit = createProgram(gl, LIT_VS, LIT_FS);
    this.sky = createProgram(gl, SKY_VS, SKY_FS);
    this.water = createProgram(gl, WATER_VS, WATER_FS);
    this.sprite = createProgram(gl, SPRITE_VS, SPRITE_FS);
    this.skyVao = gl.createVertexArray();
    gl.bindVertexArray(this.skyVao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.spriteVao = gl.createVertexArray();
    this.spriteBuf = gl.createBuffer();
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
    gl.bindVertexArray(null);
    this.frame = null;
  }

  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  uploadMesh(data) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attrs = [[data.positions, 3], [data.normals, 3], [data.colors, 4]];
    attrs.forEach(([arr, size], i) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, 0, 0);
    });
    gl.bindVertexArray(null);
    return { vao, count: data.count };
  }

  uploadWater(data) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const db = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, db);
    gl.bufferData(gl.ARRAY_BUFFER, data.depths, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: data.indices.length };
  }

  /** Start a frame: viewport, clear and the shared camera/sun uniforms. */
  beginFrame({ view, proj, camPos, sunDir, time, fogDensity }) {
    const gl = this.gl;
    const viewProj = mat4Multiply(proj, view);
    // the sky rebuilds each pixel's view ray from the camera basis and the lens
    const basis = [view[0], view[4], view[8], view[1], view[5], view[9], -view[2], -view[6], -view[10]];
    this.frame = { viewProj, camPos, sunDir, time, fogDensity, basis, lens: [1 / proj[0], 1 / proj[5]] };
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.9, 0.75, 0.6, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    return viewProj;
  }

  use(prog) {
    const gl = this.gl, f = this.frame;
    gl.useProgram(prog.p);
    gl.uniform3fv(prog.loc('uSunDir'), f.sunDir);
    gl.uniform3fv(prog.loc('uCamPos'), f.camPos);
    gl.uniform1f(prog.loc('uFogDensity'), f.fogDensity);
    gl.uniform1f(prog.loc('uTime'), f.time);
    const vp = prog.loc('uViewProj');
    if (vp) gl.uniformMatrix4fv(vp, false, f.viewProj);
    return prog;
  }

  drawSky() {
    const gl = this.gl;
    const prog = this.use(this.sky);
    gl.uniformMatrix3fv(prog.loc('uCamBasis'), false, this.frame.basis);
    gl.uniform2fv(prog.loc('uLens'), this.frame.lens);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  /** Draw a lit mesh. Options: alpha (blended when < 1), tint, decal (polygon offset level). */
  drawMesh(mesh, model, { alpha = 1, tint = [1, 1, 1], decal = 0 } = {}) {
    if (!mesh || !mesh.count) return;
    const gl = this.gl;
    const prog = this.use(this.lit);
    gl.uniformMatrix4fv(prog.loc('uModel'), false, model);
    gl.uniform1f(prog.loc('uAlpha'), alpha);
    gl.uniform3fv(prog.loc('uTint'), tint);
    if (alpha < 1) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
    }
    if (decal) {
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-decal, -decal * 2);
    }
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    if (decal) gl.disable(gl.POLYGON_OFFSET_FILL);
    if (alpha < 1) {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
  }

  drawWater(mesh) {
    const gl = this.gl;
    this.use(this.water);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
  }

  /** Draw a sprite batch: additive glows or alpha-blended puffs. */
  drawSprites(batch, { additive = false, softness = 1.5, fogged = false, depthTest = true } = {}) {
    if (!batch.count) return;
    const gl = this.gl;
    const prog = this.use(this.sprite);
    gl.uniform1f(prog.loc('uSoftness'), softness);
    gl.uniform1f(prog.loc('uFogged'), fogged ? 1 : 0);
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.data), gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    if (additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    if (!depthTest) gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, batch.count);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
