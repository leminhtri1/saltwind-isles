// The heads-up layer over the 3D view: speed and altitude tapes with big SPD / ALT readouts, the
// heading tape with HDG, the mission objective card, a waypoint marker with distance (or an edge
// arrow when it is off screen), the flight-path marker and the flashing warnings and messages.
import { clamp, projectToScreen } from './math3d.js';

const FONT = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';
const MONO = 'Consolas, "Lucida Console", Menlo, monospace';
const INK = '#f4fff4';
const ACCENT = '#7dffa8';

function panel(ctx, x, y, w, h, r = 8) {
  ctx.fillStyle = 'rgba(8, 14, 20, 0.55)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(125, 255, 168, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function shadowText(ctx, text, x, y) {
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

/** Vertical tape (speed or altitude) with a large boxed readout. */
function tape(ctx, x, y, h, value, perPx, minor, major, label, unit, side, k) {
  const w = 74 * k;
  panel(ctx, x - w / 2, y - h / 2, w, h, 6 * k);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.clip();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(15 * k)}px ${MONO}`;
  ctx.textAlign = side < 0 ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  const lo = value - (h / 2) * perPx, hi = value + (h / 2) * perPx;
  for (let v = Math.ceil(lo / minor) * minor; v <= hi; v += minor) {
    const yy = y - (v - value) / perPx;
    const isMajor = Math.round(v) % major === 0;
    const ex = side < 0 ? x + w / 2 : x - w / 2;
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(ex, yy);
    ctx.lineTo(ex + side * (isMajor ? 14 : 8) * k, yy);
    ctx.stroke();
    if (isMajor && v >= 0) ctx.fillText(String(Math.round(v)), ex + side * 18 * k, yy);
  }
  ctx.restore();
  // big readout box
  const bw = 132 * k, bh = 54 * k;
  const bx = side < 0 ? x - w / 2 - bw + 30 * k : x + w / 2 - 30 * k;
  ctx.fillStyle = 'rgba(4, 10, 14, 0.88)';
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(bx, y - bh / 2, bw, bh, 6 * k);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.font = `800 ${Math.round(14 * k)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, bx + 8 * k, y - bh / 2 + 4 * k);
  ctx.textAlign = 'right';
  ctx.fillText(unit, bx + bw - 8 * k, y - bh / 2 + 4 * k);
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.round(34 * k)}px ${MONO}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.fillText(String(Math.round(value)), bx + bw - 10 * k, y + bh / 2 - 6 * k);
}

function headingTape(ctx, cx, y, w, headingDeg, bugDeg, k) {
  const h = 34 * k;
  panel(ctx, cx - w / 2, y, w, h, 6 * k);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y, w, h);
  ctx.clip();
  const ppd = 4.2 * k;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = Math.floor((headingDeg - w / 2 / ppd) / 5) * 5; d <= headingDeg + w / 2 / ppd; d += 5) {
    const xx = cx + (d - headingDeg) * ppd;
    const dd = ((d % 360) + 360) % 360;
    const major = dd % 10 === 0;
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(xx, y + h);
    ctx.lineTo(xx, y + h - (major ? 10 : 6) * k);
    ctx.stroke();
    if (dd % 30 === 0) {
      const t = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd] || String(dd).padStart(3, '0');
      ctx.font = `700 ${Math.round((isNaN(+t) ? 17 : 13) * k)}px ${MONO}`;
      ctx.fillText(t, xx, y + 12 * k);
    }
  }
  if (bugDeg !== null) {
    let rel = ((bugDeg - headingDeg + 540) % 360) - 180;
    rel = clamp(rel, -w / 2 / ppd + 2, w / 2 / ppd - 2);
    const bx = cx + rel * ppd;
    ctx.fillStyle = '#ff5ad1';
    ctx.beginPath();
    ctx.moveTo(bx, y + h - 2);
    ctx.lineTo(bx - 7 * k, y + h - 14 * k);
    ctx.lineTo(bx + 7 * k, y + h - 14 * k);
    ctx.fill();
  }
  ctx.restore();
  const bw = 150 * k, bh = 44 * k;
  ctx.fillStyle = 'rgba(4, 10, 14, 0.88)';
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cx - bw / 2, y + h + 4 * k, bw, bh, 6 * k);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.font = `800 ${Math.round(14 * k)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('HDG', cx - bw / 2 + 9 * k, y + h + 4 * k + bh / 2);
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.round(30 * k)}px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${String(Math.round(headingDeg) % 360).padStart(3, '0')}°`, cx + bw / 2 - 10 * k, y + h + 6 * k + bh / 2);
}

function objectiveCard(ctx, x, y, k, title, lines, time) {
  const w = 360 * k, h = (40 + lines.length * 24) * k;
  panel(ctx, x, y, w, h, 8 * k);
  ctx.fillStyle = '#ffd36b';
  ctx.font = `800 ${Math.round(17 * k)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  shadowText(ctx, title.toUpperCase(), x + 12 * k, y + 9 * k);
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(17 * k)}px ${FONT}`;
  lines.forEach((l, i) => shadowText(ctx, l, x + 12 * k, y + (36 + i * 24) * k));
  if (time !== null) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd36b';
    ctx.font = `700 ${Math.round(17 * k)}px ${MONO}`;
    shadowText(ctx, time, x + w - 12 * k, y + 9 * k);
  }
}

function waypointMarker(ctx, W, H, viewProj, wp, ac, k, panelTop) {
  const dist = Math.hypot(wp.pos[0] - ac.pos[0], wp.pos[2] - ac.pos[2]);
  const distText = dist > 950 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
  const p = projectToScreen(viewProj, wp.pos, W, H);
  const margin = 50 * k;
  const onScreen = p && p.x > margin && p.x < W - margin && p.y > margin && p.y < panelTop - margin;
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ff5ad1';
  ctx.fillStyle = '#ff5ad1';
  ctx.font = `800 ${Math.round(15 * k)}px ${FONT}`;
  ctx.textAlign = 'center';
  if (onScreen) {
    const s = 12 * k;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x + s, p.y);
    ctx.lineTo(p.x, p.y + s);
    ctx.lineTo(p.x - s, p.y);
    ctx.closePath();
    ctx.stroke();
    shadowText(ctx, `${wp.label}  ${distText}`, p.x, p.y - s - 8 * k);
  } else {
    // arrow on an ellipse around the screen centre, pointing toward the target
    let dx, dy;
    if (p) { dx = p.x - W / 2; dy = p.y - H * 0.45; } else {
      const v = [wp.pos[0] - ac.pos[0], wp.pos[2] - ac.pos[2]];
      const hd = Math.atan2(v[0], -v[1]) - ac.headingRad;
      dx = Math.sin(hd);
      dy = -Math.cos(hd);
      if (dy < 0.2) dy = Math.abs(dy) + 0.3;
    }
    const a = Math.atan2(dy, dx);
    const ex = W / 2 + Math.cos(a) * W * 0.36, ey = H * 0.45 + Math.sin(a) * H * 0.3;
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(22 * k, 0);
    ctx.lineTo(-8 * k, -14 * k);
    ctx.lineTo(-2 * k, 0);
    ctx.lineTo(-8 * k, 14 * k);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-a);
    shadowText(ctx, `${wp.label}  ${distText}`, 0, -22 * k);
  }
  ctx.restore();
}

function flightPathMarker(ctx, W, H, viewProj, ac, k) {
  const sp = Math.hypot(ac.vel[0], ac.vel[1], ac.vel[2]);
  if (sp < 8) return;
  const ahead = [ac.pos[0] + ac.vel[0] / sp * 400, ac.pos[1] + ac.vel[1] / sp * 400, ac.pos[2] + ac.vel[2] / sp * 400];
  const p = projectToScreen(viewProj, ahead, W, H);
  if (!p) return;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 7 * k, 0, Math.PI * 2);
  ctx.moveTo(p.x - 17 * k, p.y);
  ctx.lineTo(p.x - 7 * k, p.y);
  ctx.moveTo(p.x + 7 * k, p.y);
  ctx.lineTo(p.x + 17 * k, p.y);
  ctx.moveTo(p.x, p.y - 7 * k);
  ctx.lineTo(p.x, p.y - 13 * k);
  ctx.stroke();
}

/** Draw the head-up layer; `s` carries the readouts, `hud` the mission card, waypoint and messages. */
export function drawHudOverlay(ctx, W, H, s, hud, viewProj, ac, panelTop, time) {
  const k = H / 800;
  const midY = Math.min(H * 0.42, panelTop - 170 * k);
  tape(ctx, 120 * k + 40 * k, midY, 300 * k, s.airspeed, 0.5 / k, 10, 20, 'SPD', 'KM/H', -1, k);
  tape(ctx, W - 160 * k, midY, 300 * k, s.alt, 2 / k, 10, 50, 'ALT', 'M', 1, k);
  headingTape(ctx, W / 2, 12 * k, 420 * k, s.heading / (Math.PI / 180), hud.bugDeg, k);
  if (hud.title) objectiveCard(ctx, 16 * k, 14 * k, k, hud.title, hud.lines, hud.clock);
  if (hud.waypoint && ac && !ac.crashed) waypointMarker(ctx, W, H, viewProj, hud.waypoint, ac, k, panelTop);
  if (hud.showFpm && ac && !ac.crashed) flightPathMarker(ctx, W, H, viewProj, ac, k);
  // AGL and ground speed beneath the readouts
  ctx.font = `700 ${Math.round(15 * k)}px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  shadowText(ctx, `AGL ${Math.round(s.agl)} m`, W - 98 * k, midY + 175 * k);
  shadowText(ctx, `VS ${s.vs >= 0 ? '+' : ''}${s.vs.toFixed(1)}`, W - 98 * k, midY + 196 * k);
  ctx.textAlign = 'left';
  shadowText(ctx, `GS ${Math.round(s.groundSpeed)}`, 100 * k, midY + 175 * k);
  shadowText(ctx, `THR ${Math.round(s.throttle * 100)}%`, 100 * k, midY + 196 * k);
  // warnings
  const blink = Math.floor(time * 4) % 2 === 0;
  const warn = s.stall ? 'STALL' : s.overspeed ? 'OVERSPEED' : s.pullUp ? 'PULL UP' : s.fuel <= 0 ? 'NO FUEL' : s.engineFail ? 'ENGINE FAILURE' : null;
  if (warn && blink) {
    ctx.font = `900 ${Math.round(44 * k)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3b2f';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText(warn, W / 2, H * 0.24);
    ctx.shadowBlur = 0;
  }
  if (hud.message) {
    ctx.font = `800 ${Math.round(28 * k)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = hud.message.color;
    ctx.globalAlpha = clamp(hud.message.left * 2, 0, 1);
    shadowText(ctx, hud.message.text, W / 2, H * 0.31);
    ctx.globalAlpha = 1;
  }
}
