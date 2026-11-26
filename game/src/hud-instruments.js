// The backlit instrument panel: six gauges, throttle/flap/fuel/damage strips and annunciator lights for each system.
import { DEG, clamp } from './math3d.js';
import { MONO, TAU, disc, gradient, line, poly, text } from './canvas-kit.js';

const LIT = '#f6ecd4', AMBER = '#ffb02e', CAP = '#d9cfb8';
const glow = (ctx, blur = 6, color = 'rgba(255, 190, 110, 0.85)') => Object.assign(ctx, { shadowColor: color, shadowBlur: blur });

function bezel(ctx) {
	disc(ctx, 0, 0, 113, gradient(ctx.createLinearGradient(-100, -100, 100, 100), ['#9aa0a8', '#34383e', '#6d727a']));
	disc(ctx, 0, 0, 102, '#050607');
	disc(ctx, 0, 0, 100, gradient(ctx.createRadialGradient(0, -30, 10, 0, 0, 100), ['#20262c', '#0b0d10']));
	for (let k = 0; k < 4; k++) disc(ctx, Math.cos(k * 1.571 + 0.785) * 130, Math.sin(k * 1.571 + 0.785) * 130, 6, '#2a2d31');
}

function dial(ctx, from, to, step, majorEvery, angle, label, px) {
	glow(ctx);
	ctx.strokeStyle = LIT;
	for (let v = from, i = 0; v <= to + 1e-6; v += step, i++) {
		const a = angle(v) - Math.PI / 2, major = i % majorEvery === 0, c = Math.cos(a), s = Math.sin(a), r = major ? 78 : 86;
		ctx.lineWidth = major ? 3.5 : 2;
		line(ctx, c * 95, s * 95, c * r, s * r);
		if (major && label) text(ctx, label(v), c * 60, s * 60, px, LIT);
	}
}

function arc(ctx, r, a0, a1, color, w) {
	Object.assign(ctx, { strokeStyle: color, lineWidth: w });
	ctx.beginPath();
	ctx.arc(0, 0, r, a0 - Math.PI / 2, a1 - Math.PI / 2);
	ctx.stroke();
}

function needle(ctx, a, len, w) {
	ctx.save();
	ctx.rotate(a);
	glow(ctx, 8);
	poly(ctx, [[-w, len * 0.18], [-w * 0.6, -len * 0.85], [0, -len], [w * 0.6, -len * 0.85], [w, len * 0.18]], '#fff7e6');
	ctx.restore();
	disc(ctx, 0, 0, w * 1.6, '#1a1c1f');
}

function airspeed(ctx, s) {
	const ang = (v) => (clamp(v, 0, 300) / 300) * 1.75 * Math.PI - 0.875 * Math.PI;
	for (const [a, b, c, r, w] of [[70, 150, '#e9e9e9', 92, 7], [95, 220, '#2fbf4f', 84, 7], [220, 266, '#f0c419', 84, 7], [266, 272, '#e83a2a', 84, 9]]) arc(ctx, r, ang(a), ang(b), c, w);
	dial(ctx, 0, 300, 10, 5, ang, (v) => (v % 50 === 0 ? String(v) : ''), 17);
	text(ctx, 'KM/H', 0, 34, 15, CAP, 700);
	needle(ctx, ang(s.airspeed), 86, 6);
}

function attitude(ctx, { pitch, bank }) {
	ctx.save();
	ctx.beginPath();
	ctx.arc(0, 0, 97, 0, TAU);
	ctx.clip();
	ctx.rotate(-bank);
	const off = (pitch / DEG) * 3.33;
	ctx.fillStyle = gradient(ctx.createLinearGradient(0, -200, 0, off), ['#0f4f9a', '#4aa3e8']);
	ctx.fillRect(-200, off - 300, 400, 300);
	ctx.fillStyle = gradient(ctx.createLinearGradient(0, off, 0, 200), ['#9a6232', '#4e2f17']);
	ctx.fillRect(-200, off, 400, 300);
	Object.assign(ctx, { strokeStyle: '#fff', lineWidth: 3 });
	line(ctx, -200, off, 200, off);
	for (let p = -30; p <= 30; p += 10) {
		if (!p) continue;
		line(ctx, -26, off - p * 3.33, 26, off - p * 3.33);
		text(ctx, String(Math.abs(p)), 40, off - p * 3.33, 13, '#fff');
	}
	ctx.restore();
	Object.assign(ctx, { strokeStyle: '#fff', lineWidth: 3 });
	for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
		const a = b * DEG - Math.PI / 2, l = b % 30 === 0 ? 80 : 87;
		line(ctx, Math.cos(a) * 96, Math.sin(a) * 96, Math.cos(a) * l, Math.sin(a) * l);
	}
	ctx.save();
	ctx.rotate(-bank);
	poly(ctx, [[0, -78], [-7, -64], [7, -64]], AMBER);
	ctx.restore();
	Object.assign(ctx, { strokeStyle: AMBER, lineWidth: 7, lineCap: 'round' });
	glow(ctx);
	for (const s of [-1, 1]) {
		ctx.beginPath();
		ctx.moveTo(s * 55, 0);
		ctx.lineTo(s * 18, 0);
		ctx.lineTo(s * 8, 10);
		ctx.stroke();
	}
	disc(ctx, 0, 0, 5, AMBER);
	ctx.lineCap = 'butt';
}

function altimeter(ctx, { alt }) {
	const ang = (v) => (v / 1000) * TAU;
	dial(ctx, 0, 980, 20, 5, ang, (v) => String(v / 100), 20);
	ctx.fillStyle = '#000';
	ctx.fillRect(-36, 20, 72, 26);
	text(ctx, String(Math.max(0, Math.round(alt))).padStart(4, '0'), 0, 33, 20, '#ffe9b8', 700, MONO);
	text(ctx, 'ALT  M', 0, -30, 15, CAP, 700);
	needle(ctx, (alt / 10000) * TAU, 50, 8);
	needle(ctx, ang(alt % 1000), 88, 5);
}

function headingDial(ctx, { heading, bearing }) {
	ctx.save();
	ctx.rotate(-heading);
	glow(ctx);
	ctx.strokeStyle = LIT;
	for (let d = 0; d < 360; d += 5) {
		const a = d * DEG - Math.PI / 2, r = d % 10 === 0 ? 80 : 87, t = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] || String(d / 10);
		ctx.lineWidth = d % 30 === 0 ? 3.5 : 1.8;
		line(ctx, Math.cos(a) * 95, Math.sin(a) * 95, Math.cos(a) * r, Math.sin(a) * r);
		if (d % 30) continue;
		ctx.save();
		ctx.translate(Math.cos(a) * 63, Math.sin(a) * 63);
		ctx.rotate(d * DEG);
		text(ctx, t, 0, 0, d % 90 ? 16 : 22, d ? LIT : '#ff9a6b', 700);
		ctx.restore();
	}
	if (bearing !== null) {
		ctx.rotate(bearing);
		poly(ctx, [[0, -96], [-10, -78], [10, -78]], '#ff5ad1');
		Object.assign(ctx, { strokeStyle: 'rgba(255,90,209,0.85)', lineWidth: 4 });
		line(ctx, 0, -70, 0, 70);
	}
	ctx.restore();
	poly(ctx, [[0, -30], [6, 0], [28, 6], [28, 12], [5, 10], [4, 22], [12, 28], [-12, 28], [-4, 22], [-5, 10], [-28, 12], [-28, 6], [-6, 0]], AMBER);
	poly(ctx, [[0, -100], [-7, -114], [7, -114]], AMBER);
}

function vsi(ctx, { vs }) {
	const ang = (v) => -Math.PI / 2 + (clamp(v, -10, 10) / 10) * Math.PI * 0.94;
	dial(ctx, -10, 10, 1, 5, ang, (v) => String(Math.abs(v)), 19);
	for (const [t, x, y] of [['UP', 15, -30], ['DN', 15, 40], ['M/S', 36, 6]]) text(ctx, t, x, y, 15, CAP, 700);
	needle(ctx, ang(vs), 86, 6);
}

function engineDial(ctx, { rpm, fuel }) {
	const ang = (v) => (clamp(v, 0, 3000) / 3000) * 1.5 * Math.PI - 0.75 * Math.PI;
	arc(ctx, 84, ang(2100), ang(2600), '#2fbf4f', 7);
	arc(ctx, 84, ang(2650), ang(2720), '#e83a2a', 8);
	dial(ctx, 0, 3000, 100, 5, ang, (v) => String(v / 100), 17);
	text(ctx, 'RPM', 0, -30, 15, CAP, 700);
	arc(ctx, 55, Math.PI * 0.82, Math.PI * 1.18, '#555', 8);
	arc(ctx, 55, Math.PI * (0.82 + (1 - fuel) * 0.36), Math.PI * 1.18, fuel < 0.15 ? '#ff5a3a' : '#f3d27a', 8);
	text(ctx, 'FUEL', 0, 72, 15, CAP, 700);
	needle(ctx, ang(rpm), 86, 6);
}

function bar(ctx, x, y, w, h, frac, color, label, value) {
	glow(ctx, 0);
	ctx.fillStyle = '#07090b';
	ctx.fillRect(x, y, w, h);
	Object.assign(ctx, { strokeStyle: '#4a4f56', lineWidth: 1.5 });
	ctx.strokeRect(x, y, w, h);
	glow(ctx);
	ctx.fillStyle = color;
	const fh = (h - 4) * clamp(frac, 0, 1);
	ctx.fillRect(x + 2, y + h - 2 - fh, w - 4, fh);
	text(ctx, label, x + w / 2, y - w * 0.45, w * 0.36, CAP, 700);
	text(ctx, value, x + w / 2, y + h + w * 0.5, w * 0.4, '#ffe9b8', 700, MONO);
}

export function drawInstrumentPanel(ctx, W, H, s, tall = false) {
	const k = H / 800, top = H - (tall ? 250 : 168) * k, face = () => gradient(ctx.createLinearGradient(0, top, 0, H), ['#3a3d42', '#25282c', '#151719']);
	ctx.save();
	ctx.beginPath();
	if (tall) {
		for (const [a, b, c] of [[0, 0.1, 0.04], [1, 0.9, 0.96]]) poly(ctx, [[W * a, 0], [W * b, 0], [W * c, top], [W * a, top]], '#1d1f22');
		ctx.fillRect(0, 0, W, H * 0.035);
		ctx.fillRect(W / 2 - 5, 0, 10, H * 0.12);
		ctx.beginPath();
		ctx.moveTo(0, top + 30 * k);
		ctx.quadraticCurveTo(W / 2, top - 40 * k, W, top + 30 * k);
		ctx.lineTo(W, H);
		ctx.lineTo(0, H);
	} else ctx.roundRect((W - Math.min(W, 1220 * k)) / 2, top, Math.min(W, 1220 * k), H, 18 * k);
	Object.assign(ctx, { fillStyle: face(), strokeStyle: 'rgba(255,220,170,0.25)', lineWidth: 2 });
	ctx.fill();
	ctx.stroke();
	const R = (tall ? 70 : 62) * k, cy = top + (tall ? 128 : 92) * k, step = R * 2.62, x0 = W / 2 - step * 2.5 - R;
	[airspeed, attitude, altimeter, headingDial, vsi, engineDial].forEach((gauge, i) => {
		ctx.save();
		ctx.translate(x0 + step * i, cy);
		ctx.scale(R / 100, R / 100);
		glow(ctx, 0);
		bezel(ctx);
		gauge(ctx, s);
		glow(ctx, 0);
		disc(ctx, 0, 0, 100, gradient(ctx.createLinearGradient(-100, -100, 20, 20), ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']));
		ctx.restore();
	});
	const bx = x0 + step * 5 + R * 1.55, bw = 22 * k, bh = R * 1.5, by = cy - bh / 2 + 4 * k, red = '#ff5a3a';
	bar(ctx, bx, by, bw, bh, s.throttle, '#7fe08a', 'THR', `${Math.round(s.throttle * 100)}`);
	bar(ctx, bx + bw * 1.7, by, bw, bh, s.flaps / 2, '#9ad0ff', 'FLP', ['UP', '1', '2'][s.flaps]);
	bar(ctx, bx + bw * 3.4, by, bw, bh, s.fuel, s.fuel < 0.15 ? red : '#f3d27a', 'FUEL', `${Math.round(s.fuelLitres)}`);
	bar(ctx, bx + bw * 5.1, by, bw, bh, s.damage, s.damage > 0.6 ? red : '#ff9a3c', 'DMG', `${Math.round(s.damage * 100)}`);
	const p = s.parts, RED = '#ff3b2f', aw = 82 * k, ah = 18 * k, span = step * 5 + R * 2;
	const flags = [
		['STALL', s.stall && RED], ['OVERSPEED', s.overspeed && RED], ['LOW FUEL', s.fuel < 0.15 && AMBER],
		p.engine >= 100 || s.engineFail ? ['ENG FAIL', RED] : p.engine > 55 ? ['ENG ROUGH', AMBER] : ['ENGINE'],
		p.gear >= 100 ? ['NO GEAR', RED] : p.gear > 30 ? ['GEAR BENT', AMBER] : ['GEAR DN', '#3ee06a'],
		p.flaps >= 100 ? ['FLAP JAM', RED] : s.flaps ? [`FLAPS ${s.flaps}`, '#4fb6ff'] : ['FLAPS UP'], ['BRAKE', s.brakes && AMBER],
	];
	flags.forEach(([t, c], i) => {
		const x = x0 - R + (i + 0.5) * span / flags.length - aw / 2, y = tall ? top + 4 * k : top - 21 * k;
		glow(ctx, c ? 14 : 0, c);
		ctx.fillStyle = c || '#1b1d20';
		ctx.fillRect(x, y, aw, ah);
		glow(ctx, 0);
		ctx.strokeStyle = '#000';
		ctx.strokeRect(x, y, aw, ah);
		text(ctx, t, x + aw / 2, y + ah / 2 + 1, ah * 0.55, c ? '#1a0c00' : '#4b4f55', 800);
	});
	ctx.restore();
	return top;
}
