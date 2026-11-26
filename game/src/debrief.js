// The debrief after a sortie: a touchdown score card with its runway diagram, the result lines, the crash explained, and a damage diagram.
import { findStrip } from './world-layout.js';
import { FONT, gradient, line, panel, poly, text, wrapText } from './canvas-kit.js';
import { drawMedal } from './screens.js';
import { sinkRating } from './landing-score.js';

const INK = '#eef4f6', DIM = '#9fb3c0';
const health = (d) => (d >= 100 ? '#ff3b2f' : d >= 50 ? '#ff8a3c' : d >= 20 ? '#ffd36b' : '#59e38b');
const condition = (d, part) => (d >= 100 ? { gear: 'COLLAPSED', flaps: 'JAMMED', engine: 'SEIZED' }[part] || 'WRECKED' : d >= 50 ? 'DAMAGED' : d >= 20 ? 'WORN' : 'OK');

/** Top-down Kittiwake with each system painted by its damage, and a legend. */
function damageDiagram(ctx, x, y, w, k, ac) {
	const wreck = !!ac.crashed, p = wreck ? { engine: 100, gear: 100, flaps: 100 } : ac.parts, air = wreck ? 100 : ac.damage;
	text(ctx, 'AIRCRAFT CONDITION', x, y, 13 * k, DIM, 800, FONT, 'left', 'top');
	const cx = x + w / 2, cy = y + 120 * k, s = w / 12.5;
	const P = (pts) => pts.map(([u, v]) => [cx + u * s, cy + v * s]);
	poly(ctx, P([[-5.6, -1.4], [5.6, -1.4], [5.6, 0], [-5.6, 0]]), health(air), 'rgba(0,0,0,0.6)');
	poly(ctx, P([[-2.85, 0], [-0.7, 0], [-0.7, 0.45], [-2.85, 0.45]]), health(p.flaps), '#000');
	poly(ctx, P([[0.7, 0], [2.85, 0], [2.85, 0.45], [0.7, 0.45]]), health(p.flaps), '#000');
	poly(ctx, P([[-0.6, -1.8], [0.6, -1.8], [0.45, 1.7], [0.12, 3.9], [-0.12, 3.9], [-0.45, 1.7]]), health(air), '#000');
	poly(ctx, P([[-1.9, 2.8], [1.9, 2.8], [1.9, 3.7], [-1.9, 3.7]]), health(air), '#000');
	poly(ctx, P([[-0.45, -3.4], [0.45, -3.4], [0.6, -1.8], [-0.6, -1.8]]), health(p.engine), '#000');
	ctx.fillStyle = 'rgba(0,0,0,0.35)';
	ctx.fillRect(cx - 1.1 * s, cy - 3.55 * s, 2.2 * s, 0.12 * s);
	for (const [u, v] of [[-1.32, -0.55], [1.32, -0.55], [0, -2.72]]) {
		ctx.fillStyle = health(p.gear);
		ctx.beginPath();
		ctx.ellipse(cx + u * s, cy + v * s, 0.22 * s, 0.4 * s, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#000';
		ctx.stroke();
	}
	const rows = [['ENGINE', p.engine, 'engine'], ['GEAR', p.gear, 'gear'], ['FLAPS', p.flaps, 'flaps'], ['AIRFRAME', air, 'airframe']];
	rows.forEach(([label, d, part], i) => {
		const ry = y + 230 * k + i * 26 * k;
		panel(ctx, x, ry, 12 * k, 12 * k, 3 * k, health(d));
		text(ctx, label, x + 20 * k, ry + 6 * k, 14 * k, INK, 800, FONT, 'left');
		text(ctx, `${Math.round(d)}%  ${condition(d, part)}`, x + w, ry + 6 * k, 14 * k, health(d), 800, FONT, 'right');
	});
	const worst = Math.max(air, p.engine, p.gear, p.flaps);
	if (!wreck && worst > 0) text(ctx, `Strip repair: about ${Math.ceil(worst / 4)} s stopped`, x, y + 340 * k, 13 * k, DIM, 700, FONT, 'left', 'top');
}

/** Plan view of the strip: threshold, touchdown zone, centreline, where the wheels met it and where the roll ended. */
function touchdownDiagram(ctx, x, y, w, k, def, card, td, stop) {
	const strip = findStrip(def.strip), L = strip.length, h = 104 * k, grass = strip.surface !== 'asphalt';
	const X = (along) => x + 14 * k + (along / L) * (w - 28 * k), Y = (across) => y + h / 2 + (across / (strip.width / 2)) * (h / 2 - 10 * k);
	panel(ctx, x, y, w, h, 8 * k, grass ? '#3f6b2a' : '#2a2c30', 'rgba(255,255,255,0.25)');
	ctx.fillStyle = 'rgba(89, 227, 139, 0.28)';
	ctx.fillRect(X(def.zone[0]), y + 4 * k, X(def.zone[1]) - X(def.zone[0]), h - 8 * k);
	text(ctx, 'ZONE', (X(def.zone[0]) + X(def.zone[1])) / 2, y + 14 * k, 11 * k, '#9dffc0', 800);
	ctx.strokeStyle = 'rgba(255,255,255,0.8)';
	ctx.lineWidth = 2 * k;
	ctx.setLineDash([12 * k, 10 * k]);
	line(ctx, X(0), Y(0), X(L), Y(0));
	ctx.setLineDash([]);
	for (let i = 0; i < 6; i++) ctx.fillRect(X(4), Y(-0.8 + i * 0.32) - 2 * k, 18 * k, 5 * k);
	text(ctx, 'THRESHOLD', X(0), y + h + 12 * k, 11 * k, DIM, 800, FONT, 'left');
	text(ctx, `${L} m`, X(L), y + h + 12 * k, 11 * k, DIM, 800, FONT, 'right');
	if (!td || card.fromThreshold === null) return;
	const tx = X(card.fromThreshold), ty = Y(td.across * def.sign);
	if (stop) {
		ctx.strokeStyle = '#ffd36b';
		ctx.setLineDash([4 * k, 5 * k]);
		line(ctx, tx, ty, X(def.sign * stop.along + L / 2), Y(stop.across * def.sign));
		ctx.setLineDash([]);
		poly(ctx, [[X(def.sign * stop.along + L / 2), Y(stop.across * def.sign) - 7 * k], [X(def.sign * stop.along + L / 2) + 7 * k, Y(stop.across * def.sign)], [X(def.sign * stop.along + L / 2), Y(stop.across * def.sign) + 7 * k]], '#ffd36b');
	}
	ctx.strokeStyle = '#ff5ad1';
	ctx.lineWidth = 4 * k;
	line(ctx, tx - 9 * k, ty - 9 * k, tx + 9 * k, ty + 9 * k);
	line(ctx, tx - 9 * k, ty + 9 * k, tx + 9 * k, ty - 9 * k);
	text(ctx, `TOUCHDOWN ${Math.round(card.fromThreshold)} m`, tx, y - 10 * k, 13 * k, '#ff8ae0', 800);
}

function statTile(ctx, x, y, w, k, label, value, note, color) {
	panel(ctx, x, y, w, 70 * k, 8 * k, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.15)');
	text(ctx, label, x + 10 * k, y + 9 * k, 11 * k, DIM, 800, FONT, 'left', 'top');
	text(ctx, value, x + 10 * k, y + 50 * k, 26 * k, color, 800, FONT, 'left', 'alphabetic');
	text(ctx, note, x + 10 * k, y + 60 * k, 11 * k, color, 700, FONT, 'left');
}

/** Result lines with their points pulled out to the right: "Smooth touchdown ... (+33)". */
function scoreLines(ctx, x, y, w, k, lines) {
	ctx.font = `600 ${Math.round(16 * k)}px ${FONT}`;
	for (const l of lines) {
		const m = l.match(/^(.*?)\s*\(([+-]\d+)\)$/);
		for (const part of wrapText(ctx, m ? m[1] : l, w - 60 * k)) {
			text(ctx, part, x, y, 16 * k, INK, 600, FONT, 'left', 'top');
			y += 22 * k;
		}
		if (m) text(ctx, m[2], x + w, y - 22 * k, 17 * k, m[2] === '+0' ? '#ff8a6b' : '#7dffa8', 800, FONT, 'right', 'top');
		y += 5 * k;
	}
	return y;
}

/** Debrief: the crash explained, or the graded result with its medal, beside the aircraft's condition. */
export function drawDebrief(ctx, W, H, def, result, report, ac) {
	const k = H / 800, w = 1000 * k, h = 640 * k, x = (W - w) / 2, y = 34 * k;
	ctx.fillStyle = 'rgba(4, 10, 16, 0.35)';
	ctx.fillRect(0, 0, W, H);
	panel(ctx, x, y, w, h, 16 * k, gradient(ctx.createLinearGradient(0, y, 0, y + h), ['rgba(12, 24, 36, 0.94)', 'rgba(6, 12, 20, 0.95)']), 'rgba(255, 211, 107, 0.5)', 2);
	const card = result.card, title = report ? 'CRASHED' : card ? `LANDING ${result.score} / 100` : result.success ? 'MISSION COMPLETE' : 'MISSION FAILED';
	text(ctx, `${def.title.toUpperCase()}  ·  DEBRIEF`, x + 30 * k, y + 24 * k, 13 * k, DIM, 800, FONT, 'left', 'top');
	text(ctx, title, x + 30 * k, y + 44 * k, 38 * k, report ? '#ff6b4f' : result.success ? '#7dffa8' : '#ffb02e', 900, FONT, 'left', 'top');
	ctx.font = `700 ${Math.round(19 * k)}px ${FONT}`;
	const headline = (report ? report.headline : result.headline) || '';
	wrapText(ctx, headline, 560 * k).forEach((l, i) => text(ctx, l, x + 30 * k, y + (96 + i * 24) * k, 19 * k, '#fff6e2', 700, FONT, 'left', 'top'));
	if (!report) {
		drawMedal(ctx, x + w - 70 * k, y + 76 * k, 34 * k, result.medal);
		text(ctx, result.medal ? result.medal.toUpperCase() : 'NO MEDAL', x + w - 70 * k, y + 126 * k, 13 * k, DIM, 800);
	}
	const lx = x + 30 * k, lw = 590 * k;
	let yy = y + 150 * k;
	if (card) {
		const td = result.touchdown, r = sinkRating(td.vs);
		touchdownDiagram(ctx, lx, yy + 18 * k, lw, k, def, card, td, result.stop);
		yy += 160 * k;
		const tw = (lw - 30 * k) / 4, good = (v) => (v ? '#7dffa8' : '#ffd36b');
		statTile(ctx, lx, yy, tw, k, 'SINK RATE', `${Math.abs(td.vs).toFixed(1)}`, `m/s  ${r.label.toUpperCase()}`, good(r.points >= 33));
		statTile(ctx, lx + tw + 10 * k, yy, tw, k, 'CENTRELINE', `${Math.abs(td.across).toFixed(1)}`, `m ${td.across * def.sign > 0 ? 'RIGHT' : 'LEFT'}`, good(Math.abs(td.across) < 2));
		statTile(ctx, lx + (tw + 10 * k) * 2, yy, tw, k, 'AIRSPEED', `${Math.round(td.speedKmh)}`, 'km/h AT CONTACT', good(td.speedKmh < 125));
		statTile(ctx, lx + (tw + 10 * k) * 3, yy, tw, k, 'ATTITUDE', `${td.pitch >= 0 ? '+' : ''}${Math.round(td.pitch)}°`, `PITCH, BANK ${Math.round(Math.abs(td.bank))}°`, good(td.pitch > 1 && Math.abs(td.bank) < 3));
		yy += 90 * k;
	}
	const lines = report ? report.lines : result.lines || [];
	scoreLines(ctx, lx, yy, lw, k, card ? lines.slice(0, 7) : lines);
	ctx.strokeStyle = 'rgba(255,255,255,0.15)';
	ctx.lineWidth = 1;
	line(ctx, x + 650 * k, y + 150 * k, x + 650 * k, y + h - 70 * k);
	damageDiagram(ctx, x + 675 * k, y + 160 * k, 295 * k, k, ac);
	text(ctx, 'ENTER fly again   ·   N next sortie   ·   M sortie board', W / 2, y + h - 34 * k, 17 * k, '#ffd36b', 800);
}
