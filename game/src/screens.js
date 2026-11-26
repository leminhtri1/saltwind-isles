// Title with mission select and medals, pause card, and the crash or results debrief.
import { MISSIONS } from './missions.js';
import { FONT, SERIF, disc, gradient, panel, poly, ring, text, wrapText } from './canvas-kit.js';

const MEDAL_COLORS = { gold: ['#fff2a8', '#e0a91c', '#8a5a00'], silver: ['#ffffff', '#b8c2cc', '#5d6a75'], bronze: ['#ffd2a8', '#c8773a', '#6e3a12'] };
const KIND_LABEL = { landing: 'LANDING', rings: 'RING COURSE', drop: 'SUPPLY DROP', mail: 'FUEL + ROUTE', free: 'EXPLORE' };

export const CONTROLS_HELP = [
  ['W / S  or  ↑ ↓', 'Pitch down / up'], ['A / D  or  ← →', 'Roll left / right'], ['Q / E', 'Rudder (steer on the ground)'],
  ['Shift / Ctrl, wheel, 1-0', 'Throttle'], ['F / R', 'Flaps down / up'], ['B', 'Wheel brakes'], ['Space', 'Drop crate'],
  ['Left-drag', 'Mouse yoke'], ['Right-drag', 'Look around'], ['C', 'Chase / cockpit view'], ['Esc / P', 'Pause'],
];

export function drawMedal(ctx, x, y, r, medal) {
  if (!medal) {
    ring(ctx, x, y, r, 'rgba(255,255,255,0.35)', 2);
    return;
  }
  const [hi, mid, lo] = MEDAL_COLORS[medal];
  poly(ctx, [[x - r * 0.7, y - r * 2.1], [x - r * 0.1, y - r * 0.6], [x + r * 0.1, y - r * 0.6], [x + r * 0.7, y - r * 2.1]], '#b3262a');
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  disc(ctx, x, y, r, gradient(ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r), [hi, mid, lo]));
  ctx.shadowBlur = 0;
  ring(ctx, x, y, r * 0.72, lo, r * 0.08);
  // a gull in flight on the medal face
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
  panel(ctx, x, y, w, h, 14, gradient(ctx.createLinearGradient(0, y, 0, y + h), ['rgba(14, 24, 34, 0.86)', 'rgba(8, 12, 18, 0.9)']), 'rgba(255, 211, 107, 0.45)', 2);
}

function controlsList(ctx, y, k, keyX, whatX, gap, align) {
  CONTROLS_HELP.forEach(([key, what], i) => {
    text(ctx, key, keyX, y + i * gap, 14 * k, '#ffd36b', 600, FONT, align, 'top');
    text(ctx, what, whatX, y + i * gap, 14 * k, '#dfe7ec', 600, FONT, 'left', 'top');
  });
}

/** Title and mission select. Returns the clickable mission rows. */
export function drawTitle(ctx, W, H, selected, best, time) {
  const k = H / 800;
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, 0, W * 0.7, 0), ['rgba(5, 10, 16, 0.65)', 'rgba(5, 10, 16, 0)']);
  ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = 'rgba(60, 20, 0, 0.6)';
  ctx.shadowBlur = 18;
  text(ctx, 'Saltwind Isles', 60 * k, 120 * k, 76 * k, '#fff6e2', 700, SERIF, 'left', 'alphabetic');
  ctx.shadowBlur = 0;
  text(ctx, 'BUSH FLYING OVER THE WINDSWEPT CHAIN, AT GOLDEN HOUR', 64 * k, 154 * k, 20 * k, '#ffd36b', 600, FONT, 'left', 'alphabetic');
  const x = 60 * k, y0 = 200 * k, rw = 470 * k, rh = 58 * k;
  const rows = MISSIONS.map((m, i) => {
    const y = y0 + i * (rh + 8 * k), sel = i === selected;
    panel(ctx, x, y, rw, rh, 10 * k, sel ? 'rgba(255, 211, 107, 0.92)' : 'rgba(10, 18, 26, 0.72)');
    text(ctx, `${i + 1}.  ${m.title}`, x + 18 * k, y + rh / 2, 22 * k, sel ? '#1b1208' : '#fff6e2', 700, FONT, 'left');
    text(ctx, KIND_LABEL[m.kind], x + rw - 64 * k, y + rh / 2, 13 * k, sel ? '#4a3510' : '#9fb3c0', 600, FONT, 'right');
    drawMedal(ctx, x + rw - 30 * k, y + rh / 2 + 4 * k, 13 * k, best[m.id] || null);
    return { x, y, w: rw, h: rh, index: i };
  });
  const m = MISSIONS[selected], bx = x + rw + 30 * k, by = 470 * k, bw = Math.min(520 * k, W - bx - 40 * k);
  card(ctx, bx, by, bw, 184 * k);
  text(ctx, m.title, bx + 22 * k, by + 18 * k, 24 * k, '#ffd36b', 800, FONT, 'left', 'top');
  ctx.font = `500 ${Math.round(18 * k)}px ${FONT}`;
  wrapText(ctx, m.brief, bw - 44 * k).forEach((l, i) => text(ctx, l, bx + 22 * k, by + (58 + i * 25) * k, 18 * k, '#e8eef2', 500, FONT, 'left', 'top'));
  text(ctx, 'ENTER or click to fly', bx + 22 * k, by + 146 * k, 18 * k, Math.floor(time * 2) % 2 ? '#ffffff' : '#ffd36b', 800, FONT, 'left', 'top');
  const keys = CONTROLS_HELP.map(([key, what]) => `${key.split('  or ')[0]} ${what.split(' (')[0].toLowerCase()}`).join('   ·   ');
  panel(ctx, 0, H - 44 * k, W, 44 * k, 0, 'rgba(5, 10, 16, 0.7)');
  ctx.font = `600 ${Math.round(14 * k)}px ${FONT}`;
  const size = Math.min(14 * k, (13 * k * (W - 40 * k)) / ctx.measureText(keys).width);
  text(ctx, keys, W / 2, H - 22 * k, size, '#dfe7ec', 600);
  return rows;
}

export function drawPause(ctx, W, H) {
  const k = H / 800, w = 520 * k, h = 400 * k, x = (W - w) / 2, y = (H - h) / 2;
  ctx.fillStyle = 'rgba(5, 10, 16, 0.55)';
  ctx.fillRect(0, 0, W, H);
  card(ctx, x, y, w, h);
  text(ctx, 'PAUSED', W / 2, y + 20 * k, 30 * k, '#ffd36b', 800, FONT, 'center', 'top');
  controlsList(ctx, y + 74 * k, k, W / 2 - 12 * k, W / 2 + 12 * k, 24 * k, 'right');
  text(ctx, 'Esc resume  ·  R restart  ·  M menu', W / 2, y + h - 36 * k, 15 * k, '#fff', 600, FONT, 'center', 'top');
}

/** Debrief after a sortie: the crash explained, or the graded result with its medal. */
export function drawDebrief(ctx, W, H, mission, result, report) {
  const k = H / 800, w = 640 * k, x = (W - w) / 2, y = 40 * k;
  const lines = report ? report.lines : result.lines || [];
  const h = (250 + lines.length * 30) * k;
  card(ctx, x, y, w, h);
  const title = report ? 'CRASHED' : result.success ? 'MISSION COMPLETE' : 'MISSION FAILED';
  text(ctx, title, W / 2, y + 22 * k, 34 * k, report ? '#ff6b4f' : result.success ? '#7dffa8' : '#ffb02e', 900, FONT, 'center', 'top');
  text(ctx, mission.title.toUpperCase(), W / 2, y + 66 * k, 15 * k, '#9fb3c0', 700, FONT, 'center', 'top');
  ctx.font = `700 ${Math.round(22 * k)}px ${FONT}`;
  wrapText(ctx, (report ? report.headline : result.headline) || '', w - 180 * k).forEach((l, i) => text(ctx, l, W / 2, y + (96 + i * 28) * k, 22 * k, '#fff6e2', 700, FONT, 'center', 'top'));
  if (!report) drawMedal(ctx, x + w - 62 * k, y + 70 * k, 30 * k, result.medal);
  ctx.font = `500 ${Math.round(17 * k)}px ${FONT}`;
  let yy = y + 168 * k;
  for (const l of lines) {
    for (const part of wrapText(ctx, l, w - 80 * k)) {
      text(ctx, part, x + 40 * k, yy, 17 * k, '#dfe7ec', 500, FONT, 'left', 'top');
      yy += 24 * k;
    }
    yy += 6 * k;
  }
  text(ctx, 'ENTER retry  ·  N next mission  ·  M menu', W / 2, y + h - 40 * k, 17 * k, '#ffd36b', 800, FONT, 'center', 'top');
}
