// The sortie board: missions with best medals, the briefing with its route chart, and the fuel/cargo loadout with predicted performance.
import { MISSIONS, routeOf } from './mission-catalog.js';
import { formatTime } from './missions.js';
import { performance } from './loadout.js';
import { AIRFRAME } from './flight-model.js';
import { WORLD_HALF } from './world-layout.js';
import { FONT, SERIF, gradient, line, panel, poly, text, wrapText } from './canvas-kit.js';
import { card, drawMedal, tile } from './screens.js';

const KIND = { landing: ['LANDING', '#7dd3ff'], rings: ['RING COURSE', '#ffd36b'], drop: ['SUPPLY DROP', '#ff9a5c'], mail: ['MAIL RUN', '#b7f07a'], free: ['EXPLORE', '#d2c2ff'] };
const INK = '#f2f6f8', DIM = '#9fb3c0', GOLD = '#ffd36b';
const KEYS = 'W/S pitch   ·   A/D roll   ·   Q/E rudder   ·   Shift/Ctrl or 1-0 throttle   ·   F/R flaps   ·   B brakes   ·   Space drop   ·   C cockpit   ·   Esc pause';

function chip(ctx, x, y, kind) {
	const [label, color] = KIND[kind];
	ctx.font = `800 12px ${FONT}`;
	const w = ctx.measureText(label).width + 16;
	panel(ctx, x - w, y, w, 20, 10, color);
	text(ctx, label, x - w / 2, y + 10.5, 12, '#0c1620', 800);
}

function medalTargets(def) {
	if (def.kind === 'landing') return 'Gold 85+   Silver 65+   Bronze 40+ points';
	if (def.medals) return `Gold under ${formatTime(def.medals[0])}   Silver under ${formatTime(def.medals[1])}`;
	return def.kind === 'drop' ? 'Gold: average crate 75+ points   Silver 50+' : 'No medals: fly where you like';
}

function routeChart(ctx, minimap, def, x, y, s) {
	const { path, marks } = routeOf(def), xs = path.map((p) => p[0]), zs = path.map((p) => p[1]);
	const span = (v) => [Math.min(...v), Math.max(...v)], [x0, x1] = span(xs), [z0, z1] = span(zs);
	const half = Math.max(x1 - x0, z1 - z0) / 2 + 650, cx = (x0 + x1) / 2 - half, cz = (z0 + z1) / 2 - half, px = minimap.size / (WORLD_HALF * 2);
	const P = ([wx, wz]) => [x + (wx - cx) / (2 * half) * s, y + (wz - cz) / (2 * half) * s];
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(x, y, s, s, 10);
	ctx.clip();
	ctx.drawImage(minimap.base, (cx + WORLD_HALF) * px, (cz + WORLD_HALF) * px, 2 * half * px, 2 * half * px, x, y, s, s);
	Object.assign(ctx, { strokeStyle: '#ff5ad1', lineWidth: 3 });
	ctx.setLineDash([8, 6]);
	ctx.beginPath();
	path.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](...P(p)));
	ctx.stroke();
	ctx.setLineDash([]);
	path.forEach((p, i) => {
		const [mx, my] = P(p), ring = marks === 'rings';
		if (!ring && !i && marks === 'drops') return;
		ctx.strokeStyle = ring ? (i ? GOLD : '#7dffa8') : marks === 'drops' ? '#ff7a2e' : '#fff';
		ctx.beginPath();
		ctx.arc(mx, my, ring ? 6 : 9, 0, Math.PI * 2);
		ctx.stroke();
		if (!ring && i) text(ctx, String(i), mx, my, 12, '#fff', 900);
	});
	const w = def.wind, a = (w.fromDeg + 180) * Math.PI / 180, ax = x + s - 34, ay = y + s - 42, d = (r, b = a) => [ax + Math.sin(b) * r, ay - Math.cos(b) * r];
	panel(ctx, ax - 26, ay - 26, 52, 62, 8, 'rgba(6, 12, 18, 0.75)');
	Object.assign(ctx, { strokeStyle: '#fff' });
	line(ctx, ...d(-14), ...d(14));
	poly(ctx, [d(18), d(9, a + 2.5), d(9, a - 2.5)], '#fff');
	text(ctx, `${Math.round(w.speed * 3.6)} km/h`, ax, ay + 27, 11, '#fff', 800);
	ctx.restore();
	panel(ctx, x, y, s, s, 10, 'rgba(0,0,0,0)', 'rgba(255, 211, 107, 0.5)', 2);
}

function loadBar(ctx, x, y, w, label, value, frac, color, keys) {
	text(ctx, label, x, y, 14, DIM, 800, FONT, 'left', 'top');
	text(ctx, keys, x + w, y, 12, '#6f8794', 700, FONT, 'right', 'top');
	const button = (bx, t) => {
		panel(ctx, bx, y + 22, 30, 30, 6, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.3)');
		text(ctx, t, bx + 15, y + 37, 20, INK, 800);
		return { x: bx, y: y + 22, w: 30, h: 30 };
	};
	panel(ctx, x + 36, y + 22, w - 72, 30, 6, '#060a0e', 'rgba(255,255,255,0.18)');
	panel(ctx, x + 38, y + 24, (w - 76) * frac, 26, 5, color);
	text(ctx, value, x + w / 2, y + 38, 17, '#fff', 800);
	return [button(x, '−'), button(x + w - 30, '+')];
}

export function drawSortieBoard(ctx, W, H, { selected, best, time, loadout, minimap }) {
	const k = H / 800, hits = [], hit = (b, v) => hits.push({ x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k, ...v });
	W /= k;
	ctx.save();
	ctx.scale(k, k);
	ctx.fillStyle = gradient(ctx.createLinearGradient(0, 0, W, 0), ['rgba(4, 12, 20, 0.82)', 'rgba(4, 12, 20, 0.55)', 'rgba(4, 12, 20, 0.2)']);
	ctx.fillRect(0, 0, W, 800);
	text(ctx, 'Saltwind Isles', 44, 84, 60, '#fffaf0', 700, SERIF, 'left', 'alphabetic');
	text(ctx, 'BUSH FLYING OVER THE TURQUOISE CHAIN', 47, 112, 16, GOLD, 700, FONT, 'left', 'alphabetic');
	text(ctx, 'SORTIES', 40, 146, 13, DIM, 800, FONT, 'left', 'bottom');
	MISSIONS.forEach((m, i) => {
		const y = 150 + i * 70, sel = i === selected, b = { x: 40, y, w: 440, h: 64 };
		panel(ctx, 40, y, 440, 64, 10, sel ? 'rgba(255, 211, 107, 0.95)' : 'rgba(10, 20, 30, 0.75)', sel ? null : 'rgba(255,255,255,0.08)');
		text(ctx, `${i + 1}`, 62, y + 32, 22, sel ? '#3a2a08' : '#5f7a8a', 900);
		text(ctx, m.title, 84, y + 22, 20, sel ? '#1b1208' : INK, 800, FONT, 'left');
		text(ctx, m.goal, 84, y + 46, 13, sel ? '#4a3510' : DIM, 600, FONT, 'left');
		chip(ctx, 424, y + 12, m.kind);
		drawMedal(ctx, 452, y + 38, 14, best[m.id]);
		hit(b, { index: i });
	});

	const def = MISSIONS[selected], bx = 512, bw = Math.min(W - bx - 36, 740), px = 538, right = bx + bw - 26;
	card(ctx, bx, 40, bw, 676);
	text(ctx, 'SORTIE BRIEFING', px, 62, 13, DIM, 800, FONT, 'left', 'top');
	text(ctx, def.title, px, 82, 32, GOLD, 800, FONT, 'left', 'top');
	chip(ctx, right, 62, def.kind);
	ctx.font = `500 17px ${FONT}`;
	wrapText(ctx, def.brief, bw - 52).forEach((l, i) => text(ctx, l, px, 130 + i * 24, 17, '#e3ebef', 500, FONT, 'left', 'top'));
	routeChart(ctx, minimap, def, px, 190, 300);
	text(ctx, `WIND ${String(def.wind.fromDeg).padStart(3, '0')}° ${Math.round(def.wind.speed * 3.6)} KM/H${def.wind.gust > 0.3 ? ', GUSTING' : ''}`, px, 500, 13, DIM, 800, FONT, 'left', 'top');

	const lx = px + 326, lw = right - lx, perf = performance(loadout), A = AIRFRAME, c = def.cargo;
	text(ctx, 'LOADOUT', lx, 190, 15, '#fff', 900, FONT, 'left', 'top');
	const [fm, fp] = loadBar(ctx, lx, 220, lw, 'FUEL', `${loadout.fuel} L  ·  ${Math.round(loadout.fuel * A.fuelKgPerLitre)} kg`, loadout.fuel / A.fuelCapacity, '#e8b23a', 'A / D');
	hit(fm, { fuel: -1 });
	hit(fp, { fuel: 1 });
	if (c) {
		const [cm, cp] = loadBar(ctx, lx, 290, lw, c.label, c.each ? `${loadout.cargo / c.each} × ${c.each} kg` : `${loadout.cargo} kg`, loadout.cargo / A.maxCargo, '#5fb8ff', 'Q / E');
		hit(cm, { cargo: -1 });
		hit(cp, { cargo: 1 });
	} else text(ctx, 'No cargo on this sortie', lx, 312, 14, '#6f8794', 700, FONT, 'left', 'top');
	const tw = (lw - 10) / 2, red = '#ff8a6b';
	tile(ctx, lx, 366, tw, 'TAKE-OFF WEIGHT', String(Math.round(perf.mass)), 'kg', perf.mass > 1050 ? red : INK);
	tile(ctx, lx + tw + 10, 366, tw, 'STALL, CLEAN', String(Math.round(perf.stallKmh)), 'km/h', INK);
	tile(ctx, lx, 438, tw, 'BEST CLIMB', perf.climb.toFixed(1), 'm/s', perf.climb > 5 ? '#7dffa8' : perf.climb > 4 ? GOLD : red);
	tile(ctx, lx + tw + 10, 438, tw, 'ENDURANCE', String(Math.round(perf.enduranceMin)), 'min', perf.enduranceMin < 6 ? red : INK);

	ctx.strokeStyle = 'rgba(255,255,255,0.15)';
	line(ctx, px, 574, right, 574);
	text(ctx, 'MEDALS', px, 588, 13, DIM, 800, FONT, 'left', 'top');
	text(ctx, medalTargets(def), px, 610, 16, INK, 700, FONT, 'left', 'top');
	text(ctx, 'YOUR BEST', px, 646, 13, DIM, 800, FONT, 'left', 'top');
	drawMedal(ctx, px + 102, 656, 13, best[def.id]);
	text(ctx, best[def.id] ? best[def.id].toUpperCase() : 'NOT YET FLOWN', px + 124, 648, 15, INK, 800, FONT, 'left', 'top');
	panel(ctx, right - 230, 632, 230, 58, 12, Math.floor(time * 2) % 2 ? '#ffd36b' : '#ffc23a');
	text(ctx, 'TAKE OFF  ⏎', right - 115, 662, 22, '#1b1208', 900);
	hit({ x: right - 230, y: 632, w: 230, h: 58 }, { go: true });
	panel(ctx, 0, 760, W, 40, 0, 'rgba(4, 10, 16, 0.8)');
	text(ctx, KEYS, W / 2, 780, 14, '#dfe7ec', 600);
	ctx.restore();
	return hits;
}
