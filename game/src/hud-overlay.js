// Head-up layer: SPD/ALT tapes, HDG tape, mission card, waypoint marker, flight-path marker, warnings.
import { clamp, projectToScreen } from './math3d.js';
import { FONT, MONO, line, panel, poly, shadowText, text } from './canvas-kit.js';

const INK = '#f4fff4';
const ACCENT = '#7dffa8';
const GLASS = 'rgba(8, 14, 20, 0.55)';
const EDGE = 'rgba(125, 255, 168, 0.35)';
const BOX = 'rgba(4, 10, 14, 0.88)';

/** A boxed readout: small label and unit over a large number. */
function readout(ctx, x, y, w, h, label, unit, value, k) {
	panel(ctx, x, y, w, h, 6 * k, BOX, ACCENT, 2.5);
	text(ctx, label, x + 8 * k, y + 4 * k, 14 * k, ACCENT, 800, FONT, 'left', 'top');
	if (unit) text(ctx, unit, x + w - 8 * k, y + 4 * k, 14 * k, ACCENT, 800, FONT, 'right', 'top');
	text(ctx, value, x + w - 10 * k, y + h - 6 * k, (unit ? 34 : 30) * k, INK, 700, MONO, 'right', 'alphabetic');
}

/** Vertical tape (side -1 on the left of the screen, +1 on the right) with its readout box. */
function tape(ctx, x, y, h, value, perPx, minor, major, label, unit, side, k) {
	const w = 74 * k, ex = x - (side * w) / 2;
	panel(ctx, x - w / 2, y - h / 2, w, h, 6 * k, GLASS, EDGE);
	ctx.save();
	ctx.beginPath();
	ctx.rect(x - w / 2, y - h / 2, w, h);
	ctx.clip();
	ctx.strokeStyle = INK;
	for (let v = Math.ceil((value - (h / 2) * perPx) / minor) * minor; v <= value + (h / 2) * perPx; v += minor) {
		const yy = y - (v - value) / perPx, big = Math.round(v) % major === 0;
		ctx.lineWidth = big ? 2 : 1;
		line(ctx, ex, yy, ex + side * (big ? 14 : 8) * k, yy);
		if (big && v >= 0) text(ctx, String(Math.round(v)), ex + side * 18 * k, yy, 15 * k, INK, 600, MONO, side < 0 ? 'right' : 'left');
	}
	ctx.restore();
	const bw = 132 * k, bh = 54 * k;
	readout(ctx, side < 0 ? x - w / 2 - bw + 30 * k : x + w / 2 - 30 * k, y - bh / 2, bw, bh, label, unit, String(Math.round(value)), k);
}

function headingTape(ctx, cx, y, w, hdg, bug, k) {
	const h = 34 * k, ppd = 4.2 * k, span = w / 2 / ppd;
	panel(ctx, cx - w / 2, y, w, h, 6 * k, GLASS, EDGE);
	ctx.save();
	ctx.beginPath();
	ctx.rect(cx - w / 2, y, w, h);
	ctx.clip();
	ctx.strokeStyle = INK;
	for (let d = Math.floor((hdg - span) / 5) * 5; d <= hdg + span; d += 5) {
		const xx = cx + (d - hdg) * ppd, dd = ((d % 360) + 360) % 360;
		ctx.lineWidth = dd % 10 === 0 ? 2 : 1;
		line(ctx, xx, y + h, xx, y + h - (dd % 10 === 0 ? 10 : 6) * k);
		if (dd % 30 === 0) {
			const t = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd] || String(dd).padStart(3, '0');
			text(ctx, t, xx, y + 12 * k, (isNaN(+t) ? 17 : 13) * k, INK, 700, MONO);
		}
	}
	if (bug !== null) {
		const bx = cx + clamp(((bug - hdg + 540) % 360) - 180, 2 - span, span - 2) * ppd;
		poly(ctx, [[bx, y + h - 2], [bx - 7 * k, y + h - 14 * k], [bx + 7 * k, y + h - 14 * k]], '#ff5ad1');
	}
	ctx.restore();
	readout(ctx, cx - 75 * k, y + h + 4 * k, 150 * k, 44 * k, 'HDG', '', `${String(Math.round(hdg) % 360).padStart(3, '0')}°`, k);
}

function missionCard(ctx, x, y, k, title, lines, clock) {
	const w = 360 * k;
	panel(ctx, x, y, w, (40 + lines.length * 24) * k, 8 * k, GLASS, EDGE);
	shadowText(ctx, title.toUpperCase(), x + 12 * k, y + 9 * k, 17 * k, '#ffd36b', 800, FONT, 'left', 'top');
	lines.forEach((l, i) => shadowText(ctx, l, x + 12 * k, y + (36 + i * 24) * k, 17 * k, INK, 600, FONT, 'left', 'top'));
	if (clock) shadowText(ctx, clock, x + w - 12 * k, y + 9 * k, 17 * k, '#ffd36b', 700, MONO, 'right', 'top');
}

function waypointMarker(ctx, W, H, viewProj, wp, ac, k, panelTop) {
	const dist = Math.hypot(wp.pos[0] - ac.pos[0], wp.pos[2] - ac.pos[2]);
	const label = `${wp.label}  ${dist > 950 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`}`;
	const p = projectToScreen(viewProj, wp.pos, W, H), m = 50 * k, s = 12 * k;
	ctx.lineWidth = 2.5;
	if (p && p.x > m && p.x < W - m && p.y > m && p.y < panelTop - m) {
		poly(ctx, [[p.x, p.y - s], [p.x + s, p.y], [p.x, p.y + s], [p.x - s, p.y]], null, '#ff5ad1');
		shadowText(ctx, label, p.x, p.y - s - 14 * k, 15 * k, '#ff5ad1', 800);
		return;
	}
	// off screen: an arrow on an ellipse around the centre, pointing the way to turn
	let dx, dy;
	if (p) { dx = p.x - W / 2; dy = p.y - H * 0.45; } else {
		const rel = Math.atan2(wp.pos[0] - ac.pos[0], -(wp.pos[2] - ac.pos[2])) - ac.headingRad;
		dx = Math.sin(rel);
		dy = Math.max(0.3, Math.abs(Math.cos(rel)));
	}
	const a = Math.atan2(dy, dx), ex = W / 2 + Math.cos(a) * W * 0.36, ey = H * 0.45 + Math.sin(a) * H * 0.3;
	const r = (u, v) => [ex + (u * Math.cos(a) - v * Math.sin(a)) * k, ey + (u * Math.sin(a) + v * Math.cos(a)) * k];
	poly(ctx, [r(22, 0), r(-8, -14), r(-2, 0), r(-8, 14)], '#ff5ad1');
	shadowText(ctx, label, ex, ey - 26 * k, 15 * k, '#ff5ad1', 800);
}

function flightPathMarker(ctx, W, H, viewProj, ac, k) {
	const v = ac.vel, sp = Math.hypot(v[0], v[1], v[2]);
	const p = sp > 8 && projectToScreen(viewProj, [ac.pos[0] + v[0] / sp * 400, ac.pos[1] + v[1] / sp * 400, ac.pos[2] + v[2] / sp * 400], W, H);
	if (!p) return;
	ctx.strokeStyle = ACCENT;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(p.x, p.y, 7 * k, 0, Math.PI * 2);
	ctx.stroke();
	line(ctx, p.x - 17 * k, p.y, p.x - 7 * k, p.y);
	line(ctx, p.x + 7 * k, p.y, p.x + 17 * k, p.y);
	line(ctx, p.x, p.y - 7 * k, p.x, p.y - 13 * k);
}

/** Draw the head-up layer; `s` carries the readouts, `hud` the mission card, waypoint and message. */
export function drawHudOverlay(ctx, W, H, s, hud, viewProj, ac, panelTop, time) {
	const k = H / 800, midY = Math.min(H * 0.42, panelTop - 170 * k);
	tape(ctx, 160 * k, midY, 300 * k, s.airspeed, 0.5 / k, 10, 20, 'SPD', 'KM/H', -1, k);
	tape(ctx, W - 160 * k, midY, 300 * k, s.alt, 2 / k, 10, 50, 'ALT', 'M', 1, k);
	headingTape(ctx, W / 2, 12 * k, 420 * k, s.heading / (Math.PI / 180), hud.bugDeg, k);
	if (hud.title) missionCard(ctx, 16 * k, 14 * k, k, hud.title, hud.lines, hud.clock);
	if (ac && !ac.crashed) {
		if (hud.waypoint) waypointMarker(ctx, W, H, viewProj, hud.waypoint, ac, k, panelTop);
		flightPathMarker(ctx, W, H, viewProj, ac, k);
		const aim = hud.dropAim && projectToScreen(viewProj, hud.dropAim, W, H);
		if (aim) {
			// where a crate released now would land
			ctx.strokeStyle = '#ffe14d';
			ctx.lineWidth = 2.5;
			ctx.strokeRect(aim.x - 11 * k, aim.y - 11 * k, 22 * k, 22 * k);
			line(ctx, aim.x - 20 * k, aim.y, aim.x + 20 * k, aim.y);
			line(ctx, aim.x, aim.y - 20 * k, aim.x, aim.y + 20 * k);
			shadowText(ctx, 'CRATE', aim.x, aim.y + 30 * k, 13 * k, '#ffe14d', 800);
		}
		const small = (t, x, y, align) => shadowText(ctx, t, x, y, 15 * k, INK, 700, MONO, align);
		small(`AGL ${Math.round(s.agl)} m`, W - 98 * k, midY + 175 * k, 'right');
		small(`VS ${s.vs >= 0 ? '+' : ''}${s.vs.toFixed(1)}`, W - 98 * k, midY + 196 * k, 'right');
		small(`GS ${Math.round(s.groundSpeed)}`, 100 * k, midY + 175 * k, 'left');
	}
	const warn = s.stall ? 'STALL' : s.overspeed ? 'OVERSPEED' : s.pullUp ? 'PULL UP' : s.fuel <= 0 ? 'NO FUEL' : s.engineFail ? 'ENGINE FAILURE' : null;
	if (warn && Math.floor(time * 4) % 2 === 0) shadowText(ctx, warn, W / 2, H * 0.24, 44 * k, '#ff3b2f', 900);
	if (hud.message) {
		ctx.globalAlpha = clamp(hud.message.left * 2, 0, 1);
		shadowText(ctx, hud.message.text, W / 2, H * 0.31, 28 * k, hud.message.color, 800);
		ctx.globalAlpha = 1;
	}
}
