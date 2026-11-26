// The backlit instrument panel: airspeed, attitude, altimeter, heading with a waypoint bug,
// vertical speed and an engine dial, plus throttle, flap, fuel and damage strips and annunciator
// lights. Drawn with canvas 2D in metal bezels with lit markings and glass glare.
import { DEG, clamp } from './math3d.js';

const LIT = '#f6ecd4';
const GLOW = 'rgba(255, 190, 110, 0.85)';
const FONT = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';
const MONO = 'Consolas, "Lucida Console", Menlo, monospace';

function bezel(ctx, x, y, R) {
  const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
  g.addColorStop(0, '#9aa0a8');
  g.addColorStop(0.45, '#34383e');
  g.addColorStop(1, '#6d727a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R * 1.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#050607';
  ctx.beginPath();
  ctx.arc(x, y, R * 1.02, 0, Math.PI * 2);
  ctx.fill();
  const f = ctx.createRadialGradient(x, y - R * 0.3, R * 0.1, x, y, R);
  f.addColorStop(0, '#20262c');
  f.addColorStop(1, '#0b0d10');
  ctx.fillStyle = f;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2d31';
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * R * 1.3, y + Math.sin(a) * R * 1.3, R * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

function glare(ctx, x, y, R) {
  const g = ctx.createLinearGradient(x - R, y - R, x + R * 0.2, y + R * 0.2);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
}

function lit(ctx, on = true) {
  ctx.shadowColor = on ? GLOW : 'transparent';
  ctx.shadowBlur = on ? 6 : 0;
}

/** Ticks and labels around a dial; `angle(v)` maps a value to radians clockwise from 12 o'clock. */
function scale(ctx, x, y, R, from, to, step, majorEvery, angle, label, fontPx) {
  ctx.strokeStyle = LIT;
  ctx.fillStyle = LIT;
  ctx.font = `600 ${fontPx}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let v = from, i = 0; v <= to + 1e-6; v += step, i++) {
    const a = angle(v) - Math.PI / 2;
    const major = i % majorEvery === 0;
    ctx.lineWidth = major ? R * 0.035 : R * 0.02;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * R * 0.95, y + Math.sin(a) * R * 0.95);
    ctx.lineTo(x + Math.cos(a) * R * (major ? 0.78 : 0.86), y + Math.sin(a) * R * (major ? 0.78 : 0.86));
    ctx.stroke();
    if (major && label) {
      const t = label(v);
      if (t !== null) ctx.fillText(t, x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.6);
    }
  }
}

function arc(ctx, x, y, R, a0, a1, color, w) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, R, a0 - Math.PI / 2, a1 - Math.PI / 2);
  ctx.stroke();
}

function needle(ctx, x, y, a, len, w, color = '#fff7e6', tail = 0.18) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.shadowColor = GLOW;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(-w, len * tail);
  ctx.lineTo(-w * 0.6, -len * 0.85);
  ctx.lineTo(0, -len);
  ctx.lineTo(w * 0.6, -len * 0.85);
  ctx.lineTo(w, len * tail);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#1a1c1f';
  ctx.beginPath();
  ctx.arc(x, y, w * 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function caption(ctx, x, y, R, text) {
  lit(ctx);
  ctx.fillStyle = '#d9cfb8';
  ctx.font = `700 ${Math.round(R * 0.15)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function airspeed(ctx, x, y, R, kmh) {
  bezel(ctx, x, y, R);
  const ang = (v) => (clamp(v, 0, 300) / 300) * 1.75 * Math.PI - 0.875 * Math.PI;
  arc(ctx, x, y, R * 0.92, ang(70), ang(150), '#e9e9e9', R * 0.07);
  arc(ctx, x, y, R * 0.84, ang(95), ang(220), '#2fbf4f', R * 0.07);
  arc(ctx, x, y, R * 0.84, ang(220), ang(266), '#f0c419', R * 0.07);
  arc(ctx, x, y, R * 0.84, ang(266), ang(272), '#e83a2a', R * 0.09);
  lit(ctx);
  scale(ctx, x, y, R, 0, 300, 10, 5, ang, (v) => (v % 50 === 0 ? String(v) : null), Math.round(R * 0.17));
  caption(ctx, x, y + R * 0.34, R, 'KM/H');
  needle(ctx, x, y, ang(kmh), R * 0.86, R * 0.06);
  lit(ctx, false);
  glare(ctx, x, y, R);
}

function attitude(ctx, x, y, R, pitch, bank) {
  bezel(ctx, x, y, R);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, R * 0.97, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-bank);
  const ppd = R / 30;
  const off = pitch / DEG * ppd;
  const sky = ctx.createLinearGradient(0, -R * 2, 0, off);
  sky.addColorStop(0, '#0f4f9a');
  sky.addColorStop(1, '#4aa3e8');
  ctx.fillStyle = sky;
  ctx.fillRect(-R * 2, -R * 3 + off, R * 4, R * 3);
  const gnd = ctx.createLinearGradient(0, off, 0, R * 2);
  gnd.addColorStop(0, '#9a6232');
  gnd.addColorStop(1, '#4e2f17');
  ctx.fillStyle = gnd;
  ctx.fillRect(-R * 2, off, R * 4, R * 3);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = R * 0.03;
  ctx.beginPath();
  ctx.moveTo(-R * 2, off);
  ctx.lineTo(R * 2, off);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${Math.round(R * 0.13)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let p = -30; p <= 30; p += 10) {
    if (!p) continue;
    const yy = off - p * ppd, w = R * 0.26;
    ctx.beginPath();
    ctx.moveTo(-w, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
    ctx.fillText(String(Math.abs(p)), w + R * 0.05, yy);
  }
  ctx.restore();
  // bank scale
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#fff';
  for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = b * DEG - Math.PI / 2;
    const l = b % 30 === 0 ? 0.16 : 0.09;
    ctx.lineWidth = R * 0.03;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.96, Math.sin(a) * R * 0.96);
    ctx.lineTo(Math.cos(a) * R * (0.96 - l), Math.sin(a) * R * (0.96 - l));
    ctx.stroke();
  }
  ctx.rotate(-bank);
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.moveTo(0, -R * 0.78);
  ctx.lineTo(-R * 0.07, -R * 0.64);
  ctx.lineTo(R * 0.07, -R * 0.64);
  ctx.fill();
  ctx.restore();
  // fixed aircraft symbol
  ctx.strokeStyle = '#ffb02e';
  ctx.lineWidth = R * 0.07;
  ctx.lineCap = 'round';
  lit(ctx);
  ctx.beginPath();
  ctx.moveTo(x - R * 0.55, y);
  ctx.lineTo(x - R * 0.18, y);
  ctx.lineTo(x - R * 0.08, y + R * 0.1);
  ctx.moveTo(x + R * 0.55, y);
  ctx.lineTo(x + R * 0.18, y);
  ctx.lineTo(x + R * 0.08, y + R * 0.1);
  ctx.stroke();
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.arc(x, y, R * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'butt';
  lit(ctx, false);
  glare(ctx, x, y, R);
}

function altimeter(ctx, x, y, R, alt) {
  bezel(ctx, x, y, R);
  lit(ctx);
  const ang = (v) => (v / 1000) * Math.PI * 2;
  scale(ctx, x, y, R, 0, 980, 20, 5, ang, (v) => (v < 1000 ? String(v / 100) : null), Math.round(R * 0.2));
  ctx.fillStyle = '#000';
  ctx.fillRect(x - R * 0.36, y + R * 0.2, R * 0.72, R * 0.26);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - R * 0.36, y + R * 0.2, R * 0.72, R * 0.26);
  ctx.fillStyle = '#ffe9b8';
  ctx.font = `700 ${Math.round(R * 0.2)}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.max(0, Math.round(alt))).padStart(4, '0'), x, y + R * 0.34);
  caption(ctx, x, y - R * 0.3, R, 'ALT  M');
  needle(ctx, x, y, (alt / 10000) * Math.PI * 2, R * 0.5, R * 0.08);
  needle(ctx, x, y, ang(alt % 1000), R * 0.88, R * 0.05);
  lit(ctx, false);
  glare(ctx, x, y, R);
}

function headingDial(ctx, x, y, R, heading, bearing) {
  bezel(ctx, x, y, R);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-heading);
  lit(ctx);
  ctx.strokeStyle = LIT;
  ctx.fillStyle = LIT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 5) {
    const a = d * DEG - Math.PI / 2, major = d % 30 === 0;
    ctx.lineWidth = major ? R * 0.035 : R * 0.018;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95);
    ctx.lineTo(Math.cos(a) * R * (d % 10 === 0 ? 0.8 : 0.87), Math.sin(a) * R * (d % 10 === 0 ? 0.8 : 0.87));
    ctx.stroke();
    if (major) {
      const t = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] || String(d / 10);
      ctx.save();
      ctx.translate(Math.cos(a) * R * 0.63, Math.sin(a) * R * 0.63);
      ctx.rotate(d * DEG);
      ctx.font = `${t.length === 1 && isNaN(+t) ? 800 : 600} ${Math.round(R * (isNaN(+t) ? 0.22 : 0.16))}px ${FONT}`;
      ctx.fillStyle = t === 'N' ? '#ff9a6b' : LIT;
      ctx.fillText(t, 0, 0);
      ctx.restore();
    }
  }
  if (bearing !== null) {
    ctx.rotate(bearing);
    ctx.fillStyle = '#ff5ad1';
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.96);
    ctx.lineTo(-R * 0.1, -R * 0.78);
    ctx.lineTo(R * 0.1, -R * 0.78);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,209,0.85)';
    ctx.lineWidth = R * 0.04;
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.7);
    ctx.lineTo(0, R * 0.7);
    ctx.stroke();
  }
  ctx.restore();
  // fixed plane symbol and lubber line
  ctx.fillStyle = '#ffb02e';
  lit(ctx);
  ctx.beginPath();
  ctx.moveTo(x, y - R * 0.3);
  ctx.lineTo(x + R * 0.06, y);
  ctx.lineTo(x + R * 0.28, y + R * 0.06);
  ctx.lineTo(x + R * 0.28, y + R * 0.12);
  ctx.lineTo(x + R * 0.05, y + R * 0.1);
  ctx.lineTo(x + R * 0.04, y + R * 0.22);
  ctx.lineTo(x + R * 0.12, y + R * 0.28);
  ctx.lineTo(x - R * 0.12, y + R * 0.28);
  ctx.lineTo(x - R * 0.04, y + R * 0.22);
  ctx.lineTo(x - R * 0.05, y + R * 0.1);
  ctx.lineTo(x - R * 0.28, y + R * 0.12);
  ctx.lineTo(x - R * 0.28, y + R * 0.06);
  ctx.lineTo(x - R * 0.06, y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - R * 1.0);
  ctx.lineTo(x - R * 0.07, y - R * 1.14);
  ctx.lineTo(x + R * 0.07, y - R * 1.14);
  ctx.fill();
  lit(ctx, false);
  glare(ctx, x, y, R);
}

function vsi(ctx, x, y, R, vs) {
  bezel(ctx, x, y, R);
  lit(ctx);
  const ang = (v) => -Math.PI / 2 + (clamp(v, -10, 10) / 10) * Math.PI * 0.94;
  scale(ctx, x, y, R, -10, 10, 1, 5, ang, (v) => String(Math.abs(v)), Math.round(R * 0.19));
  caption(ctx, x + R * 0.15, y - R * 0.3, R, 'UP');
  caption(ctx, x + R * 0.15, y + R * 0.4, R, 'DN');
  caption(ctx, x + R * 0.36, y + R * 0.06, R, 'M/S');
  needle(ctx, x, y, ang(vs), R * 0.86, R * 0.06);
  lit(ctx, false);
  glare(ctx, x, y, R);
}

function engineDial(ctx, x, y, R, rpm, fuelFrac) {
  bezel(ctx, x, y, R);
  const ang = (v) => (clamp(v, 0, 3000) / 3000) * 1.5 * Math.PI - 0.75 * Math.PI;
  arc(ctx, x, y, R * 0.84, ang(2100), ang(2600), '#2fbf4f', R * 0.07);
  arc(ctx, x, y, R * 0.84, ang(2650), ang(2720), '#e83a2a', R * 0.08);
  lit(ctx);
  scale(ctx, x, y, R, 0, 3000, 100, 5, ang, (v) => String(v / 100), Math.round(R * 0.17));
  caption(ctx, x, y - R * 0.3, R, 'RPM');
  // small fuel arc at the bottom
  const fa = (f) => Math.PI * 0.82 + (1 - f) * Math.PI * 0.36;
  arc(ctx, x, y, R * 0.55, Math.PI * 0.82, Math.PI * 1.18, '#555', R * 0.08);
  const fc = fuelFrac < 0.15 ? '#ff5a3a' : '#f3d27a';
  arc(ctx, x, y, R * 0.55, fa(fuelFrac), Math.PI * 1.18, fc, R * 0.08);
  caption(ctx, x, y + R * 0.72, R, 'FUEL');
  needle(ctx, x, y, ang(rpm), R * 0.86, R * 0.06);
  lit(ctx, false);
  glare(ctx, x, y, R);
}

function bar(ctx, x, y, w, h, frac, color, label, value) {
  ctx.fillStyle = '#07090b';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#4a4f56';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  lit(ctx);
  ctx.fillStyle = color;
  const fh = (h - 4) * clamp(frac, 0, 1);
  ctx.fillRect(x + 2, y + h - 2 - fh, w - 4, fh);
  ctx.fillStyle = '#d9cfb8';
  ctx.font = `700 ${Math.round(w * 0.36)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y - w * 0.32);
  ctx.font = `700 ${Math.round(w * 0.4)}px ${MONO}`;
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText(value, x + w / 2, y + h + w * 0.48);
  lit(ctx, false);
}

function annunciator(ctx, x, y, w, h, text, on, color) {
  ctx.fillStyle = on ? color : '#1b1d20';
  if (on) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = on ? '#1a0c00' : '#4b4f55';
  ctx.font = `800 ${Math.round(h * 0.55)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

/**
 * Draw the panel along the bottom of the screen. `s` holds airspeed (km/h), alt (m), vs (m/s),
 * pitch, bank, heading (radians), bearing (radians or null), rpm, fuel and damage fractions,
 * throttle, flaps (0-2), and warning flags. `tall` makes the deeper cockpit panel.
 */
export function drawInstrumentPanel(ctx, W, H, s, tall = false) {
  const k = H / 800;
  const ph = (tall ? 250 : 168) * k;
  const top = H - ph;
  ctx.save();
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, '#3a3d42');
  g.addColorStop(0.06, '#25282c');
  g.addColorStop(1, '#151719');
  ctx.fillStyle = g;
  const cw = Math.min(W, 1220 * k);
  const x0 = (W - cw) / 2;
  ctx.beginPath();
  if (tall) {
    ctx.moveTo(0, top + 30 * k);
    ctx.quadraticCurveTo(W / 2, top - 40 * k, W, top + 30 * k);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
  } else {
    ctx.roundRect(x0, top, cw, ph + 20, 18 * k);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,170,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const R = (tall ? 78 : 62) * k;
  const cy = top + (tall ? 128 : 92) * k;
  const step = R * 2.62;
  const n = 6;
  const startX = W / 2 - step * (n - 1) / 2 - 60 * k;
  airspeed(ctx, startX, cy, R, s.airspeed);
  attitude(ctx, startX + step, cy, R, s.pitch, s.bank);
  altimeter(ctx, startX + step * 2, cy, R, s.alt);
  headingDial(ctx, startX + step * 3, cy, R, s.heading, s.bearing);
  vsi(ctx, startX + step * 4, cy, R, s.vs);
  engineDial(ctx, startX + step * 5, cy, R, s.rpm, s.fuel);
  // strips: throttle, flaps, fuel, damage
  const bx = startX + step * 5 + R * 1.55, bw = 22 * k, bh = R * 1.5, by = cy - bh / 2 + 4 * k;
  bar(ctx, bx, by, bw, bh, s.throttle, '#7fe08a', 'THR', `${Math.round(s.throttle * 100)}`);
  bar(ctx, bx + bw * 1.7, by, bw, bh, s.flaps / 2, '#9ad0ff', 'FLP', ['UP', '1', '2'][s.flaps]);
  bar(ctx, bx + bw * 3.4, by, bw, bh, s.fuel, s.fuel < 0.15 ? '#ff5a3a' : '#f3d27a', 'FUEL', `${Math.round(s.fuelLitres)}`);
  bar(ctx, bx + bw * 5.1, by, bw, bh, s.damage, s.damage > 0.6 ? '#ff5a3a' : '#ff9a3c', 'DMG', `${Math.round(s.damage * 100)}`);
  // annunciators
  const ay = top + 8 * k, aw = 70 * k, ah = 17 * k;
  const ax = startX - R;
  const flags = [['STALL', s.stall, '#ff3b2f'], ['LOW FUEL', s.fuel < 0.15, '#ffb020'], ['BRAKE', s.brakes, '#ffb020'], ['ENGINE', s.engineFail, '#ff3b2f'], ['OVERSPEED', s.overspeed, '#ff3b2f']];
  if (!tall) {
    flags.forEach(([t, on, c], i) => annunciator(ctx, startX + step * (i + 0.5) - aw / 2, ay - 28 * k, aw, ah, t, on, c));
  } else {
    flags.forEach(([t, on, c], i) => annunciator(ctx, ax + i * (aw + 8 * k) + step * 1.2, top + 6 * k, aw, ah, t, on, c));
  }
  ctx.restore();
  return top;
}
