// Head-up layer: SPD/ALT tapes, HDG tape, mission card, waypoint marker, flight-path marker, drop reticle, warnings.
import { clamp, projectToScreen } from './math3d.js';
import { FONT, MONO, line, panel, poly, shadowText, text } from './canvas-kit.js';

const INK = '#f4fff4', ACCENT = '#7dffa8', GLASS = 'rgba(8, 14, 20, 0.55)', EDGE = 'rgba(125, 255, 168, 0.35)', PINK = '#ff5ad1';

function readout(ctx, x, y, w, h, label, unit, value) {
	panel(ctx, x, y, w, h, 8, 'rgba(4, 10, 14, 0.88)', ACCENT, 3);
	text(ctx, label, x + 10, y + h * 0.36, 19, ACCENT, 900, FONT, 'left');
	text(ctx, unit, x + 10, y + h * 0.72, 14, ACCENT, 800, FONT, 'left');
	text(ctx, value, x + w - 10, y + h * 0.56, h * 0.74, INK, 800, FONT, 'right');
}

function scale(ctx, x, y, w, h, from, to, minor, major, at, mark) {
	panel(ctx, x, y, w, h, 6, GLASS, EDGE);
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();
	ctx.strokeStyle = INK;
	for (let v = Math.ceil(from / minor) * minor; v <= to; v += minor) {
		const big = Math.round(v) % major === 0;
		ctx.lineWidth = big ? 2 : 1;
		mark(at(v), big, v);
	}
	ctx.restore();
}

function tape(ctx, x, y, value, perPx, major, label, unit, side) {
	const ex = x - side * 32;
	scale(ctx, x - 32, y - 150, 64, 300, value - 150 * perPx, value + 150 * perPx, 10, major, (v) => y - (v - value) / perPx, (yy, big, v) => {
		line(ctx, ex, yy, ex + side * (big ? 14 : 8), yy);
		if (big && v >= 0) text(ctx, String(Math.round(v)), ex + side * 18, yy, 15, INK, 600, MONO, side < 0 ? 'right' : 'left');
	});
	readout(ctx, side < 0 ? x - 160 : x - 18, y - 33, 178, 66, label, unit, String(Math.round(value)));
}

function headingTape(ctx, cx, hdg, bug) {
	scale(ctx, cx - 200, 10, 400, 34, hdg - 48, hdg + 48, 5, 10, (d) => cx + (d - hdg) * 4.2, (xx, big, d) => {
		const dd = ((d % 360) + 360) % 360, t = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd] || String(dd).padStart(3, '0');
		line(ctx, xx, 44, xx, big ? 34 : 38);
		if (dd % 30 === 0) text(ctx, t, xx, 22, isNaN(+t) ? 17 : 13, INK, 700, MONO);
	});
	if (bug !== null) {
		const bx = cx + clamp(((bug - hdg + 540) % 360) - 180, -46, 46) * 4.2;
		poly(ctx, [[bx, 42], [bx - 7, 30], [bx + 7, 30]], PINK);
	}
	readout(ctx, cx - 89, 48, 178, 60, 'HDG', 'MAG', `${String(Math.round(hdg) % 360).padStart(3, '0')}°`);
}

function missionCard(ctx, title, lines, clock) {
	panel(ctx, 16, 14, 360, 40 + lines.length * 24, 8, GLASS, EDGE);
	shadowText(ctx, title.toUpperCase(), 28, 23, 17, '#ffd36b', 800, FONT, 'left', 'top');
	lines.forEach((l, i) => shadowText(ctx, l, 28, 50 + i * 24, 17, INK, 600, FONT, 'left', 'top'));
	if (clock) shadowText(ctx, clock, 364, 23, 17, '#ffd36b', 700, MONO, 'right', 'top');
}

function waypointMarker(ctx, W, H, viewProj, wp, ac, panelTop) {
	const dist = Math.hypot(wp.pos[0] - ac.pos[0], wp.pos[2] - ac.pos[2]);
	const label = `${wp.label}  ${dist > 950 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`}`;
	const p = projectToScreen(viewProj, wp.pos, W, H);
	ctx.lineWidth = 2.5;
	if (p && p.x > 50 && p.x < W - 50 && p.y > 50 && p.y < panelTop - 50) {
		poly(ctx, [[p.x, p.y - 12], [p.x + 12, p.y], [p.x, p.y + 12], [p.x - 12, p.y]], null, PINK);
		return shadowText(ctx, label, p.x + 20, p.y, 15, PINK, 800, FONT, 'left');
	}
	const rel = Math.atan2(wp.pos[0] - ac.pos[0], -(wp.pos[2] - ac.pos[2])) - ac.headingRad;
	const a = p ? Math.atan2(p.y - H * 0.45, p.x - W / 2) : Math.atan2(Math.max(0.3, Math.abs(Math.cos(rel))), Math.sin(rel));
	const c = Math.cos(a), s = Math.sin(a), ex = W / 2 + c * W * 0.36, ey = H * 0.45 + s * H * 0.3;
	poly(ctx, [[22, 0], [-8, -14], [-2, 0], [-8, 14]].map(([u, v]) => [ex + u * c - v * s, ey + u * s + v * c]), PINK);
	shadowText(ctx, label, ex, ey - 26, 15, PINK, 800);
}

function flightPathMarker(ctx, W, H, viewProj, ac) {
	const v = ac.vel, sp = Math.hypot(...v), p = sp > 8 && projectToScreen(viewProj, ac.pos.map((c, i) => c + v[i] / sp * 400), W, H);
	if (!p) return;
	Object.assign(ctx, { strokeStyle: ACCENT, lineWidth: 2 });
	ctx.beginPath();
	ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
	ctx.stroke();
	line(ctx, p.x - 17, p.y, p.x - 7, p.y);
	line(ctx, p.x + 7, p.y, p.x + 17, p.y);
	line(ctx, p.x, p.y - 7, p.x, p.y - 13);
}

export function drawHudOverlay(ctx, W, H, s, hud, viewProj, ac, panelTop, time) {
	const k = H / 800, midY = Math.min(336, panelTop / k - 170);
	W /= k;
	H = 800;
	ctx.save();
	ctx.scale(k, k);
	tape(ctx, 175, midY, s.airspeed, 0.5, 20, 'SPD', 'KM/H', -1);
	tape(ctx, W - 175, midY, s.alt, 2, 50, 'ALT', 'M', 1);
	headingTape(ctx, W / 2, s.heading / (Math.PI / 180), hud.bugDeg);
	missionCard(ctx, hud.title, hud.lines, hud.clock);
	if (!ac.crashed) {
		if (hud.waypoint) waypointMarker(ctx, W, H, viewProj, hud.waypoint, ac, panelTop / k);
		flightPathMarker(ctx, W, H, viewProj, ac);
		const aim = hud.dropAim && projectToScreen(viewProj, hud.dropAim, W, H);
		if (aim) {
			Object.assign(ctx, { strokeStyle: '#ffe14d', lineWidth: 2.5 });
			ctx.strokeRect(aim.x - 11, aim.y - 11, 22, 22);
			line(ctx, aim.x - 20, aim.y, aim.x + 20, aim.y);
			line(ctx, aim.x, aim.y - 20, aim.x, aim.y + 20);
			shadowText(ctx, 'CRATE', aim.x, aim.y + 30, 13, '#ffe14d', 800);
		}
		const small = (t, x, y, align) => shadowText(ctx, t, x, y, 15, INK, 700, MONO, align);
		small(`AGL ${Math.round(s.agl)} m`, W - 143, midY + 168, 'left');
		small(`VS ${s.vs >= 0 ? '+' : ''}${s.vs.toFixed(1)} m/s`, W - 143, midY + 189, 'left');
		small(`GS ${Math.round(s.groundSpeed)} km/h`, 143, midY + 168, 'right');
	}
	const warn = s.stall ? 'STALL' : s.overspeed ? 'OVERSPEED' : s.pullUp ? 'PULL UP' : s.fuel <= 0 ? 'NO FUEL' : s.engineFail ? 'ENGINE FAILURE' : null;
	if (warn && Math.floor(time * 4) % 2 === 0) shadowText(ctx, warn, W / 2, 192, 44, '#ff3b2f', 900);
	if (hud.message) {
		ctx.globalAlpha = clamp(hud.message.left * 2, 0, 1);
		shadowText(ctx, hud.message.text, W / 2, 248, 28, hud.message.color, 800);
	}
	ctx.restore();
}
