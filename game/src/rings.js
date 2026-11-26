// Glowing target rings: torus mesh, course layout facing the next ring, and the fly-through test.
import { DEG, clamp, dot, length, mat4FromQuatPos, quatFromAttitude, quatRotate, sub } from './math3d.js';
import { MeshBuilder } from './mesh-builder.js';

export const RING_RADIUS = 15;

export function buildRingMesh() {
  const mb = new MeshBuilder();
  const R = RING_RADIUS, r = 1.25, n = 32, m = 6;
  const pt = (i, j) => {
    const a = (i / n) * Math.PI * 2, b = (j / m) * Math.PI * 2;
    const rr = R + Math.cos(b) * r;
    return [Math.cos(a) * rr, Math.sin(a) * rr, Math.sin(b) * r];
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const band = i % 4 < 2 ? [1, 1, 1, 1] : [0.86, 0.86, 0.86, 1];
      mb.quad(pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1), band);
    }
  }
  return mb.build();
}

/** A ring at `pos`, its opening facing along heading/pitch (degrees). */
export function makeRing(pos, headingDeg, pitchDeg = 0) {
  const q = quatFromAttitude(headingDeg * DEG, clamp(pitchDeg, -20, 20) * DEG, 0);
  return { pos, q, normal: quatRotate(q, [0, 0, -1]), model: mat4FromQuatPos(q, pos), passed: false, missed: false };
}

/** Rings for a course through anchor points [{x, z, agl}], each facing the next. */
export function layRingCourse(anchors, groundAt) {
  const pts = anchors.map((a) => [a.x, Math.max(0, groundAt(a.x, a.z)) + a.agl, a.z]);
  return pts.map((p, i) => {
    const next = pts[Math.min(i + 1, pts.length - 1)], prev = pts[Math.max(i - 1, 0)];
    const d = i < pts.length - 1 ? sub(next, p) : sub(p, prev);
    const heading = Math.atan2(d[0], -d[2]) / DEG;
    const pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])) / DEG * 0.5;
    return makeRing(p, heading, pitch);
  });
}

/** 'pass' when the segment prev→pos goes through the ring, 'miss' when it crosses its plane outside, else null. */
export function ringCrossing(ring, prev, pos) {
  const d0 = dot(sub(prev, ring.pos), ring.normal), d1 = dot(sub(pos, ring.pos), ring.normal);
  if (!(d0 < 0 && d1 >= 0)) return null;
  const t = d0 / (d0 - d1);
  const hit = [prev[0] + (pos[0] - prev[0]) * t, prev[1] + (pos[1] - prev[1]) * t, prev[2] + (pos[2] - prev[2]) * t];
  const off = length(sub(hit, ring.pos));
  if (off < RING_RADIUS) return 'pass';
  return off < RING_RADIUS * 4 ? 'miss' : null;
}
