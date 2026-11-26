// Full-screen cards drawn over the 3D view: the title with mission select and best medals, the
// pause card with the controls, and the debrief that explains a crash or grades a sortie.
import { MISSIONS } from './missions.js';

const FONT = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';
const SERIF = 'Georgia, "Palatino Linotype", "Book Antiqua", serif';
const MEDAL_COLORS = { gold: ['#fff2a8', '#e0a91c', '#8a5a00'], silver: ['#ffffff', '#b8c2cc', '#5d6a75'], bronze: ['#ffd2a8', '#c8773a', '#6e3a12'] };

export const CONTROLS_HELP = [
  ['W / S  or  ↑ ↓', 'Pitch down / up'],
  ['A / D  or  ← →', 'Roll left / right'],
  ['Q / E', 'Rudder (steer on the ground)'],
  ['Shift / Ctrl, wheel, 1-0', 'Throttle'],
  ['F / R', 'Flaps down / up'],
  ['B', 'Wheel brakes'],
  ['Space', 'Drop crate'],
  ['Left-drag', 'Mouse yoke'],
  ['Right-drag', 'Look around'],
  ['C', 'Chase / cockpit view'],
  ['Esc / P', 'Pause'],
];

export function drawMedal(ctx, x, y, r, medal) {
  if (!medal) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const [hi, mid, lo] = MEDAL_COLORS[medal];
  ctx.fillStyle = '#b3262a';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y - r * 2.1);
  ctx.lineTo(x - r * 0.1, y - r * 0.6);
  ctx.lineTo(x + r * 0.1, y - r * 0.6);
  ctx.lineTo(x + r * 0.7, y - r * 2.1);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, hi);
  g.addColorStop(0.6, mid);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = lo;
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  // a small gull in flight on the medal face
  ctx.strokeStyle = lo;
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y - r * 0.05);
  ctx.quadraticCurveTo(x - r * 0.22, y - r * 0.32, x, y + r * 0.05);
  ctx.quadraticCurveTo(x + r * 0.22, y - r * 0.32, x + r * 0.45, y - r * 0.05);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function card(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(14, 24, 34, 0.86)');
  g.addColorStop(1, 'rgba(8, 12, 18, 0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 211, 107, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function title(ctx, x, y, k) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(60, 20, 0, 0.6)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#fff6e2';
  ctx.font = `700 ${Math.round(76 * k)}px ${SERIF}`;
  ctx.fillText('Saltwind Isles', x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd36b';
  ctx.font = `600 ${Math.round(20 * k)}px ${FONT}`;
  ctx.fillText('BUSH FLYING OVER THE WINDSWEPT CHAIN, AT GOLDEN HOUR', x + 4 * k, y + 34 * k);
}

/** Title and mission select. Returns clickable row rectangles. */
export function drawTitle(ctx, W, H, selected, best, time) {
  const k = H / 800;
  const shade = ctx.createLinearGradient(0, 0, W * 0.7, 0);
  shade.addColorStop(0, 'rgba(5, 10, 16, 0.65)');
  shade.addColorStop(1, 'rgba(5, 10, 16, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  title(ctx, 60 * k, 120 * k, k);
  const rows = [];
  const x = 60 * k, y0 = 200 * k, rw = 470 * k, rh = 58 * k;
  MISSIONS.forEach((m, i) => {
    const y = y0 + i * (rh + 8 * k);
    const sel = i === selected;
    ctx.fillStyle = sel ? 'rgba(255, 211, 107, 0.92)' : 'rgba(10, 18, 26, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, rw, rh, 10 * k);
    ctx.fill();
    ctx.fillStyle = sel ? '#1b1208' : '#fff6e2';
    ctx.font = `700 ${Math.round(22 * k)}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}.  ${m.title}`, x + 18 * k, y + rh / 2);
    ctx.font = `600 ${Math.round(13 * k)}px ${FONT}`;
    ctx.fillStyle = sel ? '#4a3510' : '#9fb3c0';
    ctx.textAlign = 'right';
    ctx.fillText({ landing: 'LANDING', rings: 'RING COURSE', drop: 'SUPPLY DROP', mail: 'FUEL + ROUTE', free: 'EXPLORE' }[m.kind], x + rw - 64 * k, y + rh / 2);
    drawMedal(ctx, x + rw - 30 * k, y + rh / 2 + 4 * k, 13 * k, best[m.id] || null);
    rows.push({ x, y, w: rw, h: rh, index: i });
  });
  const m = MISSIONS[selected];
  const bx = x + rw + 30 * k, by = y0, bw = Math.min(460 * k, W - bx - 40 * k);
  card(ctx, bx, by, bw, 200 * k);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffd36b';
  ctx.font = `800 ${Math.round(24 * k)}px ${FONT}`;
  ctx.fillText(m.title, bx + 22 * k, by + 20 * k);
  ctx.fillStyle = '#e8eef2';
  ctx.font = `500 ${Math.round(18 * k)}px ${FONT}`;
  wrap(ctx, m.brief, bw - 44 * k).forEach((l, i) => ctx.fillText(l, bx + 22 * k, by + 62 * k + i * 26 * k));
  ctx.fillStyle = Math.floor(time * 2) % 2 ? '#ffffff' : '#ffd36b';
  ctx.font = `800 ${Math.round(18 * k)}px ${FONT}`;
  ctx.fillText('ENTER or click to fly', bx + 22 * k, by + 160 * k);
  card(ctx, bx, by + 220 * k, bw, 262 * k);
  ctx.font = `600 ${Math.round(14 * k)}px ${FONT}`;
  CONTROLS_HELP.forEach(([key, what], i) => {
    ctx.fillStyle = '#ffd36b';
    ctx.fillText(key, bx + 22 * k, by + 236 * k + i * 21 * k);
    ctx.fillStyle = '#dfe7ec';
    ctx.fillText(what, bx + 22 * k + bw * 0.48, by + 236 * k + i * 21 * k);
  });
  return rows;
}

export function drawPause(ctx, W, H) {
  const k = H / 800;
  ctx.fillStyle = 'rgba(5, 10, 16, 0.55)';
  ctx.fillRect(0, 0, W, H);
  const w = 520 * k, h = 400 * k, x = (W - w) / 2, y = (H - h) / 2;
  card(ctx, x, y, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffd36b';
  ctx.font = `800 ${Math.round(30 * k)}px ${FONT}`;
  ctx.fillText('PAUSED', W / 2, y + 20 * k);
  ctx.font = `600 ${Math.round(15 * k)}px ${FONT}`;
  CONTROLS_HELP.forEach(([key, what], i) => {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd36b';
    ctx.fillText(key, W / 2 - 12 * k, y + 74 * k + i * 24 * k);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#dfe7ec';
    ctx.fillText(what, W / 2 + 12 * k, y + 74 * k + i * 24 * k);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText('Esc resume  ·  R restart  ·  M menu', W / 2, y + h - 36 * k);
}

/** Debrief after a sortie: crash explanation or graded result. */
export function drawDebrief(ctx, W, H, mission, result, report) {
  const k = H / 800;
  const w = 640 * k, x = (W - w) / 2, y = 40 * k;
  const lines = report ? report.lines : result.lines || [];
  const h = (250 + lines.length * 30) * k;
  card(ctx, x, y, w, h);
  const crashed = !!report;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = crashed ? '#ff6b4f' : result.success ? '#7dffa8' : '#ffb02e';
  ctx.font = `900 ${Math.round(34 * k)}px ${FONT}`;
  ctx.fillText(crashed ? 'CRASHED' : result.success ? 'MISSION COMPLETE' : 'MISSION FAILED', W / 2, y + 22 * k);
  ctx.fillStyle = '#9fb3c0';
  ctx.font = `700 ${Math.round(15 * k)}px ${FONT}`;
  ctx.fillText(mission.title.toUpperCase(), W / 2, y + 66 * k);
  const head = (crashed ? report.headline : result.headline) || '';
  ctx.fillStyle = '#fff6e2';
  ctx.font = `700 ${Math.round(22 * k)}px ${FONT}`;
  wrap(ctx, head, w - 180 * k).forEach((l, i) => ctx.fillText(l, W / 2, y + 96 * k + i * 28 * k));
  if (!crashed) drawMedal(ctx, x + w - 62 * k, y + 70 * k, 30 * k, result.medal);
  ctx.textAlign = 'left';
  ctx.font = `500 ${Math.round(17 * k)}px ${FONT}`;
  ctx.fillStyle = '#dfe7ec';
  let yy = y + 168 * k;
  for (const l of lines) {
    for (const part of wrap(ctx, l, w - 80 * k)) {
      ctx.fillText(part, x + 40 * k, yy);
      yy += 24 * k;
    }
    yy += 6 * k;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd36b';
  ctx.font = `800 ${Math.round(17 * k)}px ${FONT}`;
  ctx.fillText('ENTER retry  ·  N next mission  ·  M menu', W / 2, y + h - 40 * k);
}
