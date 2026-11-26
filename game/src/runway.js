// Airstrip meshes: Port Saltwind's asphalt runway with threshold bars, painted designators,
// centreline, aiming blocks, edge and approach lights; the grass strips with mown bands and marker
// boards. Lights are also returned as glow points for the additive sprite pass.
import { mat4Compose, mat4RotateY, mat4Translate, mat4TransformPoint } from './math3d.js';
import { MeshBuilder } from './mesh-builder.js';
import { STRIPS, stripDesignators } from './world-layout.js';

const ASPHALT = [0.22, 0.22, 0.24, 0];
const ASPHALT_EDGE = [0.3, 0.29, 0.28, 0];
const PAINT = [0.93, 0.93, 0.9, 0];
const MOWN_A = [0.6, 0.72, 0.33, 0];
const MOWN_B = [0.52, 0.66, 0.28, 0];

// Seven-segment layout: which bars light for each digit (a b c d e f g).
const SEGMENTS = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];

function stripFrame(strip) {
  return mat4Compose(mat4Translate(strip.x, strip.elev, strip.z), mat4RotateY(-strip.heading * Math.PI / 180));
}

/** Flat rectangle on the strip surface in strip-local metres (x across, z along with -z the landing direction). */
function rect(mb, x0, z0, x1, z1, y, color) {
  mb.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color);
}

function digit(mb, n, ox, oz, w, h, bar, y, sign) {
  const seg = SEGMENTS[n];
  // segment rectangles in digit space (u right, v up)
  const R = [
    [0, h - bar, w, h], [w - bar, h / 2, w, h], [w - bar, 0, w, h / 2], [0, 0, w, bar],
    [0, 0, bar, h / 2], [0, h / 2, bar, h], [0, h / 2 - bar / 2, w, h / 2 + bar / 2],
  ];
  for (let s = 0; s < 7; s++) {
    if (seg[s] !== '1') continue;
    const [u0, v0, u1, v1] = R[s];
    const xa = sign * (ox + u0), xb = sign * (ox + u1), za = sign * (oz - v0), zb = sign * (oz - v1);
    rect(mb, Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb), y, PAINT);
  }
}

function paintRunwayEnd(mb, strip, label, sign) {
  const L = strip.length, W = strip.width, y = 0.02;
  const t = L / 2;
  const S = (x0, z0, x1, z1) => {
    const a = [sign * x0, sign * z0], b = [sign * x1, sign * z1];
    rect(mb, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), y, PAINT);
  };
  for (let k = 0; k < 4; k++) {
    const x = 2.6 + k * 3.2;
    S(x, t - 36, x + 1.8, t - 6);
    S(-x - 1.8, t - 36, -x, t - 6);
  }
  const dw = 6, dh = 16, gap = 2.5;
  const total = dw * 2 + gap;
  digit(mb, Number(label[0]), -total / 2, t - 48, dw, dh, 1.6, y, sign);
  digit(mb, Number(label[1]), -total / 2 + dw + gap, t - 48, dw, dh, 1.6, y, sign);
  S(4.5, t - 345, 10.5, t - 300);
  S(-10.5, t - 345, -4.5, t - 300);
  for (const d of [150, 450]) {
    for (let k = 0; k < 2; k++) {
      S(5 + k * 2.6, t - d - 22, 6.5 + k * 2.6, t - d);
      S(-6.5 - k * 2.6, t - d - 22, -5 - k * 2.6, t - d);
    }
  }
  for (let z = t - 80; z > 10; z -= 50) S(-0.45, z - 30, 0.45, z);
}

/** Build the strip meshes, decals and glowing light points. */
export function buildAirstrips(heightAt) {
  const base = new MeshBuilder();
  const paint = new MeshBuilder();
  const props = new MeshBuilder();
  const lights = [];

  for (const strip of STRIPS) {
    const frame = stripFrame(strip);
    const L = strip.length, W = strip.width;
    base.push(frame);
    paint.push(frame);
    props.push(frame);
    const toWorld = (x, y, z) => mat4TransformPoint(frame, [x, y, z]);
    if (strip.surface === 'asphalt') {
      rect(base, -W / 2 - 3, -L / 2 - 20, W / 2 + 3, L / 2 + 20, 0, ASPHALT_EDGE);
      rect(base, -W / 2, -L / 2, W / 2, L / 2, 0.01, ASPHALT);
      const [d1, d2] = stripDesignators(strip);
      paintRunwayEnd(paint, strip, d1, 1);
      paintRunwayEnd(paint, strip, d2, -1);
      rect(paint, -W / 2 + 0.6, -L / 2, -W / 2 + 1.4, L / 2, 0.02, PAINT);
      rect(paint, W / 2 - 1.4, -L / 2, W / 2 - 0.6, L / 2, 0.02, PAINT);
      // edge lights
      for (let z = -L / 2; z <= L / 2 + 0.1; z += 60) {
        for (const x of [-W / 2 - 1.5, W / 2 + 1.5]) {
          props.box(x, 0.35, z, 0.4, 0.7, 0.4, [1, 0.95, 0.75, 1]);
          lights.push({ pos: toWorld(x, 0.8, z), color: [1, 0.9, 0.65], size: 2.2 });
        }
      }
      // threshold and end bars
      for (const sign of [1, -1]) {
        for (let x = -W / 2; x <= W / 2 + 0.1; x += 3) {
          const z = sign * (L / 2 + 1);
          props.box(x, 0.3, z, 0.5, 0.6, 0.5, [0.4, 1, 0.5, 1]);
          lights.push({ pos: toWorld(x, 0.7, z), color: [0.35, 1, 0.45], size: 2.4 });
        }
        // approach lighting: a centre row on poles out over the shore, with crossbars
        for (let d = 40; d <= 360; d += 30) {
          const lz = sign * (L / 2 + d);
          const wp = toWorld(0, 0, lz);
          const ground = Math.max(0, heightAt(wp[0], wp[2])) - strip.elev;
          const span = d === 160 ? 15 : 2;
          for (let x = -span; x <= span + 0.1; x += d === 160 ? 3 : 1) {
            props.box(x, (ground + 1.2) / 2, lz, 0.25, 1.2 - ground, 0.25, [0.35, 0.33, 0.3, 0]);
            props.box(x, 1.35, lz, 0.5, 0.35, 0.5, [1, 0.97, 0.85, 1]);
            lights.push({ pos: toWorld(x, 1.5, lz), color: [1, 0.93, 0.75], size: 3.2 });
          }
        }
        // PAPI boxes left of the touchdown zone
        for (let k = 0; k < 4; k++) {
          const px = -W / 2 - 12 - k * 4, pz = sign * (L / 2 - 300);
          props.box(sign * px, 0.6, pz, 1.4, 1.2, 1.4, [0.2, 0.2, 0.22, 0]);
          lights.push({ pos: toWorld(sign * px, 1.0, pz), color: [1, 1, 1], size: 3, papi: { strip: strip.id, index: k, sign } });
        }
      }
    } else {
      // mown grass bands
      const band = 20;
      for (let z = -L / 2, k = 0; z < L / 2; z += band, k++) rect(base, -W / 2, z, W / 2, Math.min(L / 2, z + band), 0.01, k % 2 ? MOWN_A : MOWN_B);
      for (let z = -L / 2; z <= L / 2 + 0.1; z += 55) {
        for (const x of [-W / 2 - 1, W / 2 + 1]) {
          props.box(x, 0.35, z, 0.9, 0.7, 0.5, Math.abs(z) > L / 2 - 1 ? [0.95, 0.45, 0.15, 0] : [0.95, 0.95, 0.92, 0]);
        }
      }
      for (const sign of [1, -1]) {
        for (const x of [-W / 2 - 1, -W / 4, 0, W / 4, W / 2 + 1]) {
          props.box(x, 0.5, sign * (L / 2 + 2), 2.2, 1, 0.3, [0.98, 0.52, 0.12, 0]);
        }
      }
    }
    base.pop();
    paint.pop();
    props.pop();
  }
  return { base: base.build(), paint: paint.build(), props: props.build(), lights };
}
