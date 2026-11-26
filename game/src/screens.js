// Shared screen pieces: the medal, the card and stat tile the board and debrief use, and the pause card.
import { FONT, disc, gradient, panel, poly, ring, text } from './canvas-kit.js';

const MEDAL_COLORS = { gold: ['#fff2a8', '#e0a91c', '#8a5a00'], silver: ['#ffffff', '#b8c2cc', '#5d6a75'], bronze: ['#ffd2a8', '#c8773a', '#6e3a12'] };
export const KEYS = 'W/S pitch   ·   A/D roll   ·   Q/E rudder   ·   Shift/Ctrl or 1-0 throttle   ·   F/R flaps   ·   B brakes   ·   Space drop   ·   C cockpit   ·   Esc pause';

export function drawMedal(ctx, x, y, r, medal) {
	if (!medal) return ring(ctx, x, y, r, 'rgba(255,255,255,0.35)', 2);
	const [hi, mid, lo] = MEDAL_COLORS[medal];
	poly(ctx, [[x - r * 0.7, y - r * 2.1], [x - r * 0.1, y - r * 0.6], [x + r * 0.1, y - r * 0.6], [x + r * 0.7, y - r * 2.1]], '#b3262a');
	disc(ctx, x, y, r, gradient(ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r), [hi, mid, lo]));
	ring(ctx, x, y, r * 0.72, lo, r * 0.08);
	ctx.lineWidth = r * 0.1;
	ctx.beginPath();
	ctx.moveTo(x - r * 0.45, y - r * 0.05);
	ctx.quadraticCurveTo(x - r * 0.22, y - r * 0.32, x, y + r * 0.05);
	ctx.quadraticCurveTo(x + r * 0.22, y - r * 0.32, x + r * 0.45, y - r * 0.05);
	ctx.stroke();
}

export function card(ctx, x, y, w, h) {
	panel(ctx, x, y, w, h, 16, gradient(ctx.createLinearGradient(0, y, 0, y + h), ['rgba(12, 24, 36, 0.93)', 'rgba(6, 12, 20, 0.95)']), 'rgba(255, 211, 107, 0.5)', 2);
}

export function tile(ctx, x, y, w, label, value, unit, color) {
	panel(ctx, x, y, w, 62, 8, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.15)');
	text(ctx, label, x + 10, y + 9, 11, '#9fb3c0', 800, FONT, 'left', 'top');
	text(ctx, value, x + 10, y + 52, 26, color, 800, FONT, 'left', 'alphabetic');
	text(ctx, unit, x + 14 + ctx.measureText(value).width, y + 51, 12, color, 700, FONT, 'left', 'alphabetic');
}

export function drawPause(ctx, W, H) {
	const k = H / 800;
	ctx.fillStyle = 'rgba(5, 10, 16, 0.55)';
	ctx.fillRect(0, 0, W, H);
	ctx.save();
	ctx.setTransform(k, 0, 0, k, (W - 1280 * k) / 2, 0);
	card(ctx, 240, 300, 800, 200);
	text(ctx, 'PAUSED', 640, 340, 34, '#ffd36b', 900);
	text(ctx, KEYS, 640, 400, 14, '#dfe7ec', 600);
	text(ctx, 'Esc resume   ·   R restart   ·   M sortie board', 640, 450, 17, '#fff', 700);
	ctx.restore();
}
