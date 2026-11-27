// The debrief after a sortie: a touchdown score card with its runway diagram, the result lines, the crash explained, and a damage diagram.
import { findStrip } from './world-layout.js';
import { FONT, line, panel, poly, text, textTL, wrapText } from './canvas-kit.js';
import { card, drawMedal, tile } from './screens.js';
import { sinkRating } from './landing-score.js';

const INK = '#eef4f6', DIM = '#9fb3c0', GOOD = '#7dffa8', FAIR = '#ffd36b';
const health = (d) => (d >= 100 ? '#ff3b2f' : d >= 50 ? '#ff8a3c' : d >= 20 ? FAIR : '#59e38b');
const FAILED = { gear: 'COLLAPSED', flaps: 'JAMMED', engine: 'SEIZED', airframe: 'WRECKED' };

function damageDiagram(ctx, x, y, w, ac) {
	const p = ac.crashed ? { engine: 100, gear: 100, flaps: 100, airframe: 100 } : ac.parts, cx = x + w / 2, cy = y + 120, s = w / 12.5;
	const shape = (pts, d) => poly(ctx, pts.map(([u, v]) => [cx + u * s, cy + v * s]), health(d), '#000');
	textTL(ctx, 'AIRCRAFT CONDITION', x, y, 13, DIM, 800);
	shape([[-5.6, -1.4], [5.6, -1.4], [5.6, 0], [-5.6, 0]], p.airframe);
	for (const m of [1, -1]) shape([[m * 0.7, 0], [m * 2.85, 0], [m * 2.85, 0.45], [m * 0.7, 0.45]], p.flaps);
	shape([[-0.6, -1.8], [0.6, -1.8], [0.45, 1.7], [0.12, 3.9], [-0.12, 3.9], [-0.45, 1.7]], p.airframe);
	shape([[-1.9, 2.8], [1.9, 2.8], [1.9, 3.7], [-1.9, 3.7]], p.airframe);
	shape([[-0.45, -3.4], [0.45, -3.4], [0.6, -1.8], [-0.6, -1.8]], p.engine);
	for (const [u, v] of [[-1.32, -0.55], [1.32, -0.55], [0, -2.72]]) shape([[u - 0.2, v - 0.4], [u + 0.2, v - 0.4], [u + 0.2, v + 0.4], [u - 0.2, v + 0.4]], p.gear);
	Object.keys(FAILED).forEach((part, i) => {
		const d = p[part], ry = y + 236 + i * 26;
		panel(ctx, x, ry - 6, 12, 12, 3, health(d));
		text(ctx, part.toUpperCase(), x + 20, ry, 14, INK, 800, FONT, 'left');
		text(ctx, `${Math.round(d)}%  ${d >= 100 ? FAILED[part] : d >= 50 ? 'DAMAGED' : d >= 20 ? 'WORN' : 'OK'}`, x + w, ry, 14, health(d), 800, FONT, 'right');
	});
	const worst = Math.max(...Object.values(p));
	if (!ac.crashed && worst > 0) textTL(ctx, `Strip repair: about ${Math.ceil(worst / 4)} s stopped`, x, y + 340, 13, DIM, 700);
}

function touchdownDiagram(ctx, x, y, w, def, card, td, stop) {
	const strip = findStrip(def.strip), L = strip.length, h = 104, sg = def.sign;
	const X = (a) => x + 14 + (a / L) * (w - 28), Y = (c) => y + h / 2 + c * sg / (strip.width / 2) * (h / 2 - 10);
	panel(ctx, x, y, w, h, 8, strip.surface === 'asphalt' ? '#2a2c30' : '#3f6b2a', 'rgba(255,255,255,0.25)');
	ctx.fillStyle = 'rgba(89, 227, 139, 0.28)';
	ctx.fillRect(X(def.zone[0]), y + 4, X(def.zone[1]) - X(def.zone[0]), h - 8);
	text(ctx, 'ZONE', (X(def.zone[0]) + X(def.zone[1])) / 2, y + 14, 11, '#9dffc0', 800);
	Object.assign(ctx, { strokeStyle: 'rgba(255,255,255,0.8)', lineWidth: 2, fillStyle: '#fff' });
	ctx.setLineDash([12, 10]);
	line(ctx, X(0), Y(0), X(L), Y(0));
	for (let i = 0; i < 6; i++) ctx.fillRect(X(4), y + 30 + i * 9, 18, 5);
	text(ctx, 'THRESHOLD', X(0), y + h + 12, 11, DIM, 800, FONT, 'left');
	text(ctx, `${L} m`, X(L), y + h + 12, 11, DIM, 800, FONT, 'right');
	if (card.fromThreshold === null) return;
	const tx = X(card.fromThreshold), ty = Y(td.across), sx = X(sg * stop.along + L / 2), sy = Y(stop.across);
	Object.assign(ctx, { strokeStyle: FAIR });
	ctx.setLineDash([4, 5]);
	line(ctx, tx, ty, sx, sy);
	ctx.setLineDash([]);
	poly(ctx, [[sx, sy - 7], [sx + 7, sy], [sx, sy + 7]], FAIR);
	Object.assign(ctx, { strokeStyle: '#ff5ad1', lineWidth: 4 });
	line(ctx, tx - 9, ty - 9, tx + 9, ty + 9);
	line(ctx, tx - 9, ty + 9, tx + 9, ty - 9);
	text(ctx, `TOUCHDOWN ${Math.round(card.fromThreshold)} m`, tx, y - 10, 13, '#ff8ae0', 800);
}

export function drawDebrief(ctx, W, H, def, result, report, ac) {
	const k = H / 800, c = result.card, lines = report ? report.lines : result.lines || [];
	ctx.fillStyle = 'rgba(4, 10, 16, 0.35)';
	ctx.fillRect(0, 0, W, H);
	ctx.save();
	ctx.setTransform(k, 0, 0, k, (W - 1280 * k) / 2, 0);
	card(ctx, 140, 34, 1000, 640);
	textTL(ctx, `${def.title.toUpperCase()}  ·  DEBRIEF`, 170, 58, 13, DIM, 800);
	textTL(ctx, report ? 'CRASHED' : c ? `LANDING ${result.score} / 100` : result.success ? 'MISSION COMPLETE' : 'MISSION FAILED', 170, 78, 38, report ? '#ff6b4f' : result.success ? GOOD : '#ffb02e', 900);
	ctx.font = `700 19px ${FONT}`;
	wrapText(ctx, (report || result).headline || '', 560).forEach((l, i) => textTL(ctx, l, 170, 130 + i * 24, 19, '#fff6e2', 700));
	if (!report) {
		drawMedal(ctx, 1070, 110, 34, result.medal);
		text(ctx, result.medal ? result.medal.toUpperCase() : 'NO MEDAL', 1070, 160, 13, DIM, 800);
	}
	let y = 184;
	if (c) {
		const td = result.touchdown, r = sinkRating(td.vs), ok = (v) => (v ? GOOD : FAIR), tw = 140, side = td.across * def.sign > 0 ? 'RIGHT' : 'LEFT';
		touchdownDiagram(ctx, 170, 202, 590, def, c, td, result.stop);
		tile(ctx, 170, 344, tw, 'SINK RATE', Math.abs(td.vs).toFixed(1), `m/s ${r.label.toUpperCase()}`, ok(r.points >= 33));
		tile(ctx, 320, 344, tw, 'CENTRELINE', Math.abs(td.across).toFixed(1), `m ${side}`, ok(Math.abs(td.across) < 2));
		tile(ctx, 470, 344, tw, 'AIRSPEED', String(Math.round(td.speedKmh)), 'km/h', ok(td.speedKmh < 125));
		tile(ctx, 620, 344, tw, 'PITCH, BANK', `${Math.round(td.pitch)}°`, `${Math.round(Math.abs(td.bank))}° bank`, ok(td.pitch > 1 && Math.abs(td.bank) < 3));
		y = 426;
	}
	ctx.font = `600 16px ${FONT}`;
	for (const l of lines.slice(0, 8)) {
		const m = l.match(/^(.*?)\s*\(([+-]\d+)\)$/);
		for (const part of wrapText(ctx, m ? m[1] : l, 530)) textTL(ctx, part, 170, (y += 22) - 22, 16, INK, 600);
		if (m) text(ctx, m[2], 760, y - 22, 17, m[2] === '+0' ? '#ff8a6b' : GOOD, 800, FONT, 'right', 'top');
		y += 5;
	}
	ctx.strokeStyle = 'rgba(255,255,255,0.15)';
	ctx.lineWidth = 1;
	line(ctx, 790, 184, 790, 604);
	damageDiagram(ctx, 815, 194, 295, ac);
	text(ctx, 'ENTER fly again   ·   N next sortie   ·   M sortie board', 640, 640, 17, FAIR, 800);
	ctx.restore();
}
