// The backlit instrument panel: airspeed, attitude, altimeter, heading with a waypoint bug,
// vertical speed and an engine dial, plus throttle, flap, fuel and damage strips and annunciator
// lights, in metal bezels with lit markings and glass glare.
import { DEG, clamp } from './math3d.js';
import { MONO, TAU, disc, gradient, line, poly, text } from './canvas-kit.js';

const LIT = '#f6ecd4';
const GLOW = 'rgba(255, 190, 110, 0.85)';

function lit(ctx, on = true) {
  ctx.shadowColor = GLOW;
  ctx.shadowBlur = on ? 6 : 0;
}

/** Metal bezel, dark face and mounting screws. */
function bezel(ctx, x, y, R) {
  disc(ctx, x, y, R * 1.13, gradient(ctx.createLinearGradient(x - R, y - R, x + R, y + R), ['#9aa0a8', '#34383e', '#6d727a']));
  disc(ctx, x, y, R * 1.02, '#050607');
  disc(ctx, x, y, R, gradient(ctx.createRadialGradient(x, y - R * 0.3, R * 0.1, x, y, R), ['#20262c', '#0b0d10']));
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    disc(ctx, x + Math.cos(a) * R * 1.3, y + Math.sin(a) * R * 1.3, R * 0.06, '#2a2d31');
  }
}

function glare(ctx, x, y, R) {
  lit(ctx, false);
  disc(ctx, x, y, R, gradient(ctx.createLinearGradient(x - R, y - R, x + R * 0.2, y + R * 0.2), ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']));
}

/** Ticks and labels; `angle(v)` maps a value to radians clockwise from 12 o'clock. */
function dial(ctx, x, y, R, from, to, step, majorEvery, angle, label, px) {
  ctx.strokeStyle = LIT;
  for (let v = from, i = 0; v <= to + 1e-6; v += step, i++) {
    const a = angle(v) - Math.PI / 2, major = i % majorEvery === 0;
    const c = Math.cos(a), s = Math.sin(a), r1 = major ? 0.78 : 0.86;
    ctx.lineWidth = R * (major ? 0.035 : 0.02);
    line(ctx, x + c * R * 0.95, y + s * R * 0.95, x + c * R * r1, y + s * R * r1);
    const t = major && label ? label(v) : null;
    if (t !== null) litText(ctx, t, x + c * R * 0.6, y + s * R * 0.6, px);
  }
}

function arc(ctx, x, y, R, a0, a1, color, w) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, R, a0 - Math.PI / 2, a1 - Math.PI / 2);
  ctx.stroke();
}

function needle(ctx, x, y, a, len, w) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.shadowColor = GLOW;
  ctx.shadowBlur = 8;
  poly(ctx, [[-w, len * 0.18], [-w * 0.6, -len * 0.85], [0, -len], [w * 0.6, -len * 0.85], [w, len * 0.18]], '#fff7e6');
  ctx.restore();
  disc(ctx, x, y, w * 1.6, '#1a1c1f');
}

const caption = (ctx, x, y, R, t) => text(ctx, t, x, y, R * 0.15, '#d9cfb8', 700);
const litText = (ctx, t, x, y, px) => text(ctx, t, x, y, px, LIT);

function airspeed(ctx, x, y, R, kmh) {
  const ang = (v) => (clamp(v, 0, 300) / 300) * 1.75 * Math.PI - 0.875 * Math.PI;
  arc(ctx, x, y, R * 0.92, ang(70), ang(150), '#e9e9e9', R * 0.07);
  arc(ctx, x, y, R * 0.84, ang(95), ang(220), '#2fbf4f', R * 0.07);
  arc(ctx, x, y, R * 0.84, ang(220), ang(266), '#f0c419', R * 0.07);
  arc(ctx, x, y, R * 0.84, ang(266), ang(272), '#e83a2a', R * 0.09);
  lit(ctx);
  dial(ctx, x, y, R, 0, 300, 10, 5, ang, (v) => (v % 50 === 0 ? String(v) : null), R * 0.17);
  caption(ctx, x, y + R * 0.34, R, 'KM/H');
  needle(ctx, x, y, ang(kmh), R * 0.86, R * 0.06);
}

function attitude(ctx, x, y, R, pitch, bank) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, R * 0.97, 0, TAU);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-bank);
  const ppd = R / 30, off = (pitch / DEG) * ppd;
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, -R * 2, 0, off), ['#0f4f9a', '#4aa3e8']);
  ctx.fillRect(-R * 2, off - R * 3, R * 4, R * 3);
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, off, 0, R * 2), ['#9a6232', '#4e2f17']);
  ctx.fillRect(-R * 2, off, R * 4, R * 3);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = R * 0.03;
  line(ctx, -R * 2, off, R * 2, off);
  for (let p = -30; p <= 30; p += 10) {
    if (!p) continue;
    const yy = off - p * ppd;
    line(ctx, -R * 0.26, yy, R * 0.26, yy);
    text(ctx, String(Math.abs(p)), R * 0.4, yy, R * 0.13, '#fff');
  }
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = b * DEG - Math.PI / 2, l = 0.96 - (b % 30 === 0 ? 0.16 : 0.09);
    line(ctx, Math.cos(a) * R * 0.96, Math.sin(a) * R * 0.96, Math.cos(a) * R * l, Math.sin(a) * R * l);
  }
  ctx.rotate(-bank);
  poly(ctx, [[0, -R * 0.78], [-R * 0.07, -R * 0.64], [R * 0.07, -R * 0.64]], '#ffb02e');
  ctx.restore();
  // fixed aircraft symbol
  ctx.strokeStyle = '#ffb02e';
  ctx.lineWidth = R * 0.07;
  ctx.lineCap = 'round';
  lit(ctx);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * R * 0.55, y);
    ctx.lineTo(x + s * R * 0.18, y);
    ctx.lineTo(x + s * R * 0.08, y + R * 0.1);
    ctx.stroke();
  }
  disc(ctx, x, y, R * 0.05, '#ffb02e');
  ctx.lineCap = 'butt';
}

function altimeter(ctx, x, y, R, alt) {
  lit(ctx);
  const ang = (v) => (v / 1000) * TAU;
  dial(ctx, x, y, R, 0, 980, 20, 5, ang, (v) => String(v / 100), R * 0.2);
  ctx.fillStyle = '#000';
  ctx.fillRect(x - R * 0.36, y + R * 0.2, R * 0.72, R * 0.26);
  text(ctx, String(Math.max(0, Math.round(alt))).padStart(4, '0'), x, y + R * 0.33, R * 0.2, '#ffe9b8', 700, MONO);
  caption(ctx, x, y - R * 0.3, R, 'ALT  M');
  needle(ctx, x, y, (alt / 10000) * TAU, R * 0.5, R * 0.08);
  needle(ctx, x, y, ang(alt % 1000), R * 0.88, R * 0.05);
}

function headingDial(ctx, x, y, R, heading, bearing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-heading);
  lit(ctx);
  ctx.strokeStyle = LIT;
  for (let d = 0; d < 360; d += 5) {
    const a = d * DEG - Math.PI / 2, r1 = d % 10 === 0 ? 0.8 : 0.87;
    ctx.lineWidth = R * (d % 30 === 0 ? 0.035 : 0.018);
    line(ctx, Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, Math.cos(a) * R * r1, Math.sin(a) * R * r1);
    if (d % 30 === 0) {
      const t = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] || String(d / 10);
      ctx.save();
      ctx.translate(Math.cos(a) * R * 0.63, Math.sin(a) * R * 0.63);
      ctx.rotate(d * DEG);
      text(ctx, t, 0, 0, R * (t.length === 1 && isNaN(+t) ? 0.22 : 0.16), t === 'N' ? '#ff9a6b' : LIT, 700);
      ctx.restore();
    }
  }
  if (bearing !== null) {
    ctx.rotate(bearing);
    poly(ctx, [[0, -R * 0.96], [-R * 0.1, -R * 0.78], [R * 0.1, -R * 0.78]], '#ff5ad1');
    ctx.strokeStyle = 'rgba(255,90,209,0.85)';
    ctx.lineWidth = R * 0.04;
    line(ctx, 0, -R * 0.7, 0, R * 0.7);
  }
  ctx.restore();
  // fixed aircraft symbol and lubber mark
  const k = R / 100, P = (pts) => pts.map(([px, py]) => [x + px * k, y + py * k]);
  poly(ctx, P([[0, -30], [6, 0], [28, 6], [28, 12], [5, 10], [4, 22], [12, 28], [-12, 28], [-4, 22], [-5, 10], [-28, 12], [-28, 6], [-6, 0]]), '#ffb02e');
  poly(ctx, P([[0, -100], [-7, -114], [7, -114]]), '#ffb02e');
}

function vsi(ctx, x, y, R, vs) {
  lit(ctx);
  const ang = (v) => -Math.PI / 2 + (clamp(v, -10, 10) / 10) * Math.PI * 0.94;
  dial(ctx, x, y, R, -10, 10, 1, 5, ang, (v) => String(Math.abs(v)), R * 0.19);
  caption(ctx, x + R * 0.15, y - R * 0.3, R, 'UP');
  caption(ctx, x + R * 0.15, y + R * 0.4, R, 'DN');
  caption(ctx, x + R * 0.36, y + R * 0.06, R, 'M/S');
  needle(ctx, x, y, ang(vs), R * 0.86, R * 0.06);
}

function engineDial(ctx, x, y, R, rpm, fuel) {
  const ang = (v) => (clamp(v, 0, 3000) / 3000) * 1.5 * Math.PI - 0.75 * Math.PI;
  arc(ctx, x, y, R * 0.84, ang(2100), ang(2600), '#2fbf4f', R * 0.07);
  arc(ctx, x, y, R * 0.84, ang(2650), ang(2720), '#e83a2a', R * 0.08);
  lit(ctx);
  dial(ctx, x, y, R, 0, 3000, 100, 5, ang, (v) => String(v / 100), R * 0.17);
  caption(ctx, x, y - R * 0.3, R, 'RPM');
  arc(ctx, x, y, R * 0.55, Math.PI * 0.82, Math.PI * 1.18, '#555', R * 0.08);
  arc(ctx, x, y, R * 0.55, Math.PI * 0.82 + (1 - fuel) * Math.PI * 0.36, Math.PI * 1.18, fuel < 0.15 ? '#ff5a3a' : '#f3d27a', R * 0.08);
  caption(ctx, x, y + R * 0.72, R, 'FUEL');
  needle(ctx, x, y, ang(rpm), R * 0.86, R * 0.06);
}

function bar(ctx, x, y, w, h, frac, color, label, value) {
  lit(ctx, false);
  ctx.fillStyle = '#07090b';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#4a4f56';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  lit(ctx);
  ctx.fillStyle = color;
  const fh = (h - 4) * clamp(frac, 0, 1);
  ctx.fillRect(x + 2, y + h - 2 - fh, w - 4, fh);
  text(ctx, label, x + w / 2, y - w * 0.45, w * 0.36, '#d9cfb8', 700);
  text(ctx, value, x + w / 2, y + h + w * 0.5, w * 0.4, '#ffe9b8', 700, MONO);
}

function annunciator(ctx, x, y, w, h, label, on, color) {
  ctx.shadowColor = color;
  ctx.shadowBlur = on ? 14 : 0;
  ctx.fillStyle = on ? color : '#1b1d20';
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x, y, w, h);
  text(ctx, label, x + w / 2, y + h / 2 + 1, h * 0.55, on ? '#1a0c00' : '#4b4f55', 800);
}

/**
 * Draw the panel along the bottom of the screen and return its top edge. `s` holds airspeed
 * (km/h), alt (m), vs (m/s), pitch, bank, heading and bearing (radians), rpm, fuel and damage
 * fractions, throttle, flaps (0-2) and warning flags; `tall` draws the deeper cockpit panel.
 */
export function drawInstrumentPanel(ctx, W, H, s, tall = false) {
  const k = H / 800, ph = (tall ? 250 : 168) * k, top = H - ph;
  ctx.save();
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, top, 0, H), ['#3a3d42', '#25282c', '#151719']);
  ctx.beginPath();
  if (tall) {
    ctx.moveTo(0, top + 30 * k);
    ctx.quadraticCurveTo(W / 2, top - 40 * k, W, top + 30 * k);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
  } else {
    const cw = Math.min(W, 1220 * k);
    ctx.roundRect((W - cw) / 2, top, cw, ph + 20, 18 * k);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,170,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const R = (tall ? 70 : 62) * k, cy = top + (tall ? 128 : 92) * k, step = R * 2.62;
  const x0 = W / 2 - step * 2.5 - R;
  const gauges = [
    (x) => airspeed(ctx, x, cy, R, s.airspeed), (x) => attitude(ctx, x, cy, R, s.pitch, s.bank),
    (x) => altimeter(ctx, x, cy, R, s.alt), (x) => headingDial(ctx, x, cy, R, s.heading, s.bearing),
    (x) => vsi(ctx, x, cy, R, s.vs), (x) => engineDial(ctx, x, cy, R, s.rpm, s.fuel),
  ];
  gauges.forEach((draw, i) => {
    lit(ctx, false);
    bezel(ctx, x0 + step * i, cy, R);
    draw(x0 + step * i);
    glare(ctx, x0 + step * i, cy, R);
  });
  const bx = x0 + step * 5 + R * 1.55, bw = 22 * k, bh = R * 1.5, by = cy - bh / 2 + 4 * k;
  bar(ctx, bx, by, bw, bh, s.throttle, '#7fe08a', 'THR', `${Math.round(s.throttle * 100)}`);
  bar(ctx, bx + bw * 1.7, by, bw, bh, s.flaps / 2, '#9ad0ff', 'FLP', ['UP', '1', '2'][s.flaps]);
  bar(ctx, bx + bw * 3.4, by, bw, bh, s.fuel, s.fuel < 0.15 ? '#ff5a3a' : '#f3d27a', 'FUEL', `${Math.round(s.fuelLitres)}`);
  bar(ctx, bx + bw * 5.1, by, bw, bh, s.damage, s.damage > 0.6 ? '#ff5a3a' : '#ff9a3c', 'DMG', `${Math.round(s.damage * 100)}`);
  const flags = [['STALL', s.stall, '#ff3b2f'], ['LOW FUEL', s.fuel < 0.15, '#ffb020'], ['BRAKE', s.brakes, '#ffb020'], ['ENGINE', s.engineFail, '#ff3b2f'], ['OVERSPEED', s.overspeed, '#ff3b2f']];
  const aw = 70 * k, ah = 17 * k;
  flags.forEach(([t, on, c], i) => {
    const ax = tall ? x0 + step * 0.2 + i * (aw + 8 * k) : x0 + step * (i + 0.5) - aw / 2;
    annunciator(ctx, ax, tall ? top + 6 * k : top - 20 * k, aw, ah, t, on, c);
  });
  ctx.restore();
  return top;
}
