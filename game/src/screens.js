// Shared screen pieces: the medal, the controls list and the pause card.
import { FONT, disc, gradient, panel, poly, ring, text } from './canvas-kit.js';

const MEDAL_COLORS = { gold: ['#fff2a8', '#e0a91c', '#8a5a00'], silver: ['#ffffff', '#b8c2cc', '#5d6a75'], bronze: ['#ffd2a8', '#c8773a', '#6e3a12'] };

const CONTROLS_HELP = [
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

export function drawPause(ctx, W, H) {
	const k = H / 800, w = 520 * k, h = 400 * k, x = (W - w) / 2, y = (H - h) / 2;
	ctx.fillStyle = 'rgba(5, 10, 16, 0.55)';
	ctx.fillRect(0, 0, W, H);
	card(ctx, x, y, w, h);
	text(ctx, 'PAUSED', W / 2, y + 20 * k, 30 * k, '#ffd36b', 800, FONT, 'center', 'top');
	controlsList(ctx, y + 74 * k, k, W / 2 - 12 * k, W / 2 + 12 * k, 24 * k, 'right');
	text(ctx, 'Esc resume  ·  R restart  ·  M menu', W / 2, y + h - 36 * k, 15 * k, '#fff', 600, FONT, 'center', 'top');
}
