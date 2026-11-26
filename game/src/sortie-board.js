// The sortie board: missions with best medals, the briefing with its route chart, and the fuel/cargo loadout with predicted performance.
import { MISSIONS, routeOf } from './mission-catalog.js';
import { formatTime } from './missions.js';
import { performance } from './loadout.js';
import { AIRFRAME } from './flight-model.js';
import { WORLD_HALF } from './world-layout.js';
import { FONT, SERIF, gradient, line, panel, poly, text, wrapText } from './canvas-kit.js';
import { drawMedal } from './screens.js';

const KIND = {
	landing: ['LANDING', '#7dd3ff'], rings: ['RING COURSE', '#ffd36b'], drop: ['SUPPLY DROP', '#ff9a5c'], mail: ['MAIL RUN', '#b7f07a'], free: ['EXPLORE', '#d2c2ff'],
};
const INK = '#f2f6f8', DIM = '#9fb3c0', GOLD = '#ffd36b';
const FLIGHT_KEYS = 'W/S pitch   ·   A/D roll   ·   Q/E rudder   ·   Shift/Ctrl or 1-0 throttle   ·   F/R flaps   ·   B brakes   ·   Space drop   ·   C cockpit   ·   Esc pause';

function chip(ctx, x, y, kind, k, align = 'left') {
	const [label, color] = KIND[kind];
	ctx.font = `800 ${Math.round(12 * k)}px ${FONT}`;
	const w = ctx.measureText(label).width + 16 * k, x0 = align === 'right' ? x - w : x;
	panel(ctx, x0, y, w, 20 * k, 10 * k, color);
	text(ctx, label, x0 + w / 2, y + 10.5 * k, 12 * k, '#0c1620', 800);
}

function medalTargets(def) {
	if (def.kind === 'landing') return 'Gold 85+   Silver 65+   Bronze 40+ points';
	if (def.medals) return `Gold under ${formatTime(def.medals[0])}   Silver under ${formatTime(def.medals[1])}`;
	if (def.kind === 'drop') return 'Gold: average crate 75+ points   Silver 50+';
	return 'No medals: fly where you like';
}

/** The mission's route on a zoomed piece of the chart, with its rings, drop marks or strips and the wind. */
function routeChart(ctx, minimap, def, x, y, s, k) {
	const { path, marks } = routeOf(def);
	const xs = path.map((p) => p[0]), zs = path.map((p) => p[1]);
	const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + 650;
	const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cz = (Math.max(...zs) + Math.min(...zs)) / 2;
	const P = ([wx, wz]) => [x + (wx - cx + half) / (2 * half) * s, y + (wz - cz + half) / (2 * half) * s];
	const px = minimap.size / (WORLD_HALF * 2);
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(x, y, s, s, 10 * k);
	ctx.fillStyle = '#0d5a78';
	ctx.fill();
	ctx.clip();
	ctx.drawImage(minimap.base, (cx - half + WORLD_HALF) * px, (cz - half + WORLD_HALF) * px, 2 * half * px, 2 * half * px, x, y, s, s);
	ctx.setLineDash([8 * k, 6 * k]);
	ctx.strokeStyle = '#ff5ad1';
	ctx.lineWidth = 3 * k;
	ctx.beginPath();
	path.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
	ctx.stroke();
	ctx.setLineDash([]);
	path.forEach((p, i) => {
		const [mx, my] = P(p);
		ctx.lineWidth = 3 * k;
		if (marks === 'rings') {
			ctx.strokeStyle = i === 0 ? '#7dffa8' : GOLD;
			ctx.beginPath();
			ctx.arc(mx, my, 6 * k, 0, Math.PI * 2);
			ctx.stroke();
		} else if (i > 0 || marks === 'strips') {
			ctx.strokeStyle = marks === 'drops' ? '#ff7a2e' : '#ffffff';
			ctx.beginPath();
			ctx.arc(mx, my, 9 * k, 0, Math.PI * 2);
			ctx.stroke();
			if (i > 0) text(ctx, String(i), mx, my, 12 * k, '#fff', 900);
		}
	});
	// wind arrow, blowing from where the wind comes
	const w = def.wind, a = (w.fromDeg + 180) * Math.PI / 180, ax = x + s - 34 * k, ay = y + s - 42 * k;
	panel(ctx, ax - 26 * k, ay - 26 * k, 52 * k, 62 * k, 8 * k, 'rgba(6, 12, 18, 0.75)');
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 3 * k;
	line(ctx, ax - Math.sin(a) * 14 * k, ay + Math.cos(a) * 14 * k, ax + Math.sin(a) * 14 * k, ay - Math.cos(a) * 14 * k);
	poly(ctx, [[ax + Math.sin(a) * 18 * k, ay - Math.cos(a) * 18 * k], [ax + Math.sin(a + 2.5) * 9 * k, ay - Math.cos(a + 2.5) * 9 * k], [ax + Math.sin(a - 2.5) * 9 * k, ay - Math.cos(a - 2.5) * 9 * k]], '#fff');
	text(ctx, `${Math.round(w.speed * 3.6)} km/h`, ax, ay + 27 * k, 11 * k, '#fff', 800);
	ctx.restore();
	ctx.strokeStyle = 'rgba(255, 211, 107, 0.5)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.roundRect(x, y, s, s, 10 * k);
	ctx.stroke();
}

/** A labelled load bar with − and + buttons; returns their hit boxes. */
function loadBar(ctx, x, y, w, k, label, value, frac, color, keys) {
	text(ctx, label, x, y, 14 * k, DIM, 800, FONT, 'left', 'top');
	text(ctx, keys, x + w, y, 12 * k, '#6f8794', 700, FONT, 'right', 'top');
	const by = y + 22 * k, bh = 30 * k, b = 30 * k;
	const button = (bx, t) => {
		panel(ctx, bx, by, b, bh, 6 * k, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.3)');
		text(ctx, t, bx + b / 2, by + bh / 2, 20 * k, INK, 800);
		return { x: bx, y: by, w: b, h: bh };
	};
	const minus = button(x, '−'), plus = button(x + w - b, '+');
	const tx = x + b + 6 * k, tw = w - 2 * b - 12 * k;
	panel(ctx, tx, by, tw, bh, 6 * k, '#060a0e', 'rgba(255,255,255,0.18)');
	panel(ctx, tx + 2, by + 2, Math.max(0, (tw - 4) * frac), bh - 4, 5 * k, color);
	text(ctx, value, tx + tw / 2, by + bh / 2 + 1, 17 * k, '#fff', 800);
	return { minus, plus };
}

function tile(ctx, x, y, w, h, k, label, value, unit, color) {
	panel(ctx, x, y, w, h, 8 * k, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.14)');
	text(ctx, label, x + 10 * k, y + 9 * k, 11 * k, DIM, 800, FONT, 'left', 'top');
	text(ctx, value, x + 10 * k, y + h - 9 * k, 26 * k, color, 800, FONT, 'left', 'alphabetic');
	ctx.font = `800 ${Math.round(26 * k)}px ${FONT}`;
	text(ctx, unit, x + 14 * k + ctx.measureText(value).width, y + h - 10 * k, 13 * k, DIM, 700, FONT, 'left', 'alphabetic');
}

/** Draw the board. Returns hit boxes: mission rows {index}, loadout buttons {fuel|cargo: ±1} and the take-off button {go}. */
export function drawSortieBoard(ctx, W, H, { selected, best, time, loadout, minimap }) {
	const k = H / 800, hits = [];
	ctx.fillStyle = gradient(ctx.createLinearGradient(0, 0, W, 0), ['rgba(4, 12, 20, 0.82)', 'rgba(4, 12, 20, 0.55)', 'rgba(4, 12, 20, 0.2)']);
	ctx.fillRect(0, 0, W, H);
	ctx.shadowColor = 'rgba(0, 30, 60, 0.6)';
	ctx.shadowBlur = 16;
	text(ctx, 'Saltwind Isles', 44 * k, 84 * k, 60 * k, '#fffaf0', 700, SERIF, 'left', 'alphabetic');
	ctx.shadowBlur = 0;
	text(ctx, 'BUSH FLYING OVER THE TURQUOISE CHAIN', 47 * k, 112 * k, 16 * k, GOLD, 700, FONT, 'left', 'alphabetic');

	// the sortie list
	const x = 40 * k, y0 = 150 * k, rw = 440 * k, rh = 64 * k;
	text(ctx, 'SORTIES', x, y0 - 4 * k, 13 * k, DIM, 800, FONT, 'left', 'bottom');
	MISSIONS.forEach((m, i) => {
		const y = y0 + i * (rh + 6 * k), sel = i === selected;
		panel(ctx, x, y, rw, rh, 10 * k, sel ? 'rgba(255, 211, 107, 0.95)' : 'rgba(10, 20, 30, 0.75)', sel ? null : 'rgba(255,255,255,0.08)');
		text(ctx, `${i + 1}`, x + 22 * k, y + rh / 2, 22 * k, sel ? '#3a2a08' : '#5f7a8a', 900);
		text(ctx, m.title, x + 44 * k, y + 22 * k, 20 * k, sel ? '#1b1208' : INK, 800, FONT, 'left');
		text(ctx, m.goal, x + 44 * k, y + 46 * k, 13 * k, sel ? '#4a3510' : DIM, 600, FONT, 'left');
		chip(ctx, x + rw - 56 * k, y + 12 * k, m.kind, k, 'right');
		drawMedal(ctx, x + rw - 28 * k, y + rh / 2 + 6 * k, 14 * k, best[m.id] || null);
		hits.push({ x, y, w: rw, h: rh, index: i });
	});

	// the briefing card
	const def = MISSIONS[selected], bx = 512 * k, by = 40 * k, bw = Math.min(W - bx - 36 * k, 740 * k), bh = 676 * k;
	panel(ctx, bx, by, bw, bh, 16 * k, gradient(ctx.createLinearGradient(0, by, 0, by + bh), ['rgba(12, 24, 36, 0.92)', 'rgba(6, 12, 20, 0.94)']), 'rgba(255, 211, 107, 0.5)', 2);
	const px = bx + 26 * k;
	text(ctx, 'SORTIE BRIEFING', px, by + 22 * k, 13 * k, DIM, 800, FONT, 'left', 'top');
	text(ctx, def.title, px, by + 42 * k, 32 * k, GOLD, 800, FONT, 'left', 'top');
	chip(ctx, bx + bw - 26 * k, by + 22 * k, def.kind, k, 'right');
	ctx.font = `500 ${Math.round(17 * k)}px ${FONT}`;
	wrapText(ctx, def.brief, bw - 52 * k).forEach((l, i) => text(ctx, l, px, by + (90 + i * 24) * k, 17 * k, '#e3ebef', 500, FONT, 'left', 'top'));

	const cs = 300 * k, cy = by + 150 * k;
	routeChart(ctx, minimap, def, px, cy, cs, k);
	text(ctx, `WIND ${String(def.wind.fromDeg).padStart(3, '0')}° ${Math.round(def.wind.speed * 3.6)} KM/H${def.wind.gust > 0.3 ? ', GUSTING' : ''}`, px, cy + cs + 10 * k, 13 * k, DIM, 800, FONT, 'left', 'top');

	// loadout and what it does to the aeroplane
	const lx = px + cs + 26 * k, lw = bx + bw - 26 * k - lx, perf = performance(loadout), A = AIRFRAME;
	text(ctx, 'LOADOUT', lx, cy, 15 * k, '#fff', 900, FONT, 'left', 'top');
	const fuel = loadBar(ctx, lx, cy + 30 * k, lw, k, 'FUEL', `${loadout.fuel} L  ·  ${Math.round(loadout.fuel * A.fuelKgPerLitre)} kg`, loadout.fuel / A.fuelCapacity, '#e8b23a', 'A / D');
	hits.push({ ...fuel.minus, fuel: -1 }, { ...fuel.plus, fuel: 1 });
	if (def.cargo) {
		const c = def.cargo, value = c.each ? `${loadout.cargo / c.each} × ${c.each} kg` : `${loadout.cargo} kg`;
		const cargo = loadBar(ctx, lx, cy + 100 * k, lw, k, c.label, value, loadout.cargo / A.maxCargo, '#5fb8ff', 'Q / E');
		hits.push({ ...cargo.minus, cargo: -1 }, { ...cargo.plus, cargo: 1 });
	} else text(ctx, 'No cargo on this sortie', lx, cy + 122 * k, 14 * k, '#6f8794', 700, FONT, 'left', 'top');
	const tw = (lw - 10 * k) / 2, th = 62 * k, ty = cy + 176 * k;
	const climbColor = perf.climb > 5 ? '#7dffa8' : perf.climb > 4 ? GOLD : '#ff8a6b';
	tile(ctx, lx, ty, tw, th, k, 'TAKE-OFF WEIGHT', String(Math.round(perf.mass)), 'kg', perf.mass > 1050 ? '#ff8a6b' : INK);
	tile(ctx, lx + tw + 10 * k, ty, tw, th, k, 'STALL, CLEAN', String(Math.round(perf.stallKmh)), 'km/h', INK);
	tile(ctx, lx, ty + th + 10 * k, tw, th, k, 'BEST CLIMB', perf.climb.toFixed(1), 'm/s', climbColor);
	tile(ctx, lx + tw + 10 * k, ty + th + 10 * k, tw, th, k, 'ENDURANCE', String(Math.round(perf.enduranceMin)), 'min', perf.enduranceMin < 6 ? '#ff8a6b' : INK);

	// medals and the go button
	const my = by + bh - 128 * k;
	line(ctx, px, my - 14 * k, bx + bw - 26 * k, my - 14 * k);
	text(ctx, 'MEDALS', px, my, 13 * k, DIM, 800, FONT, 'left', 'top');
	text(ctx, medalTargets(def), px, my + 22 * k, 16 * k, INK, 700, FONT, 'left', 'top');
	text(ctx, 'YOUR BEST', px, my + 58 * k, 13 * k, DIM, 800, FONT, 'left', 'top');
	drawMedal(ctx, px + 102 * k, my + 68 * k, 13 * k, best[def.id] || null);
	text(ctx, best[def.id] ? best[def.id].toUpperCase() : 'NOT YET FLOWN', px + 124 * k, my + 60 * k, 15 * k, INK, 800, FONT, 'left', 'top');
	const gw = 230 * k, gh = 58 * k, gx = bx + bw - 26 * k - gw, gy = by + bh - 26 * k - gh;
	panel(ctx, gx, gy, gw, gh, 12 * k, Math.floor(time * 2) % 2 ? '#ffd36b' : '#ffc23a');
	text(ctx, 'TAKE OFF  ⏎', gx + gw / 2, gy + gh / 2 + 1, 22 * k, '#1b1208', 900);
	hits.push({ x: gx, y: gy, w: gw, h: gh, go: true });

	panel(ctx, 0, H - 40 * k, W, 40 * k, 0, 'rgba(4, 10, 16, 0.8)');
	text(ctx, FLIGHT_KEYS, W / 2, H - 20 * k, 14 * k, '#dfe7ec', 600);
	return hits;
}
