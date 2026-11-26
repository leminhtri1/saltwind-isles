// Canvas-2D helpers shared by the instruments, head-up layer, chart and screens.

export const FONT = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';
export const SERIF = 'Georgia, "Palatino Linotype", "Book Antiqua", serif';
export const MONO = 'Consolas, "Lucida Console", Menlo, monospace';
export const TAU = Math.PI * 2;

export function disc(ctx, x, y, r, fill) {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, TAU);
	ctx.fill();
}

export function ring(ctx, x, y, r, stroke, width) {
	ctx.strokeStyle = stroke;
	ctx.lineWidth = width;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, TAU);
	ctx.stroke();
}

export function poly(ctx, pts, fill, stroke) {
	ctx.beginPath();
	pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
	ctx.closePath();
	if (fill) { ctx.fillStyle = fill; ctx.fill(); }
	if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

export function line(ctx, x0, y0, x1, y1) {
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	ctx.lineTo(x1, y1);
	ctx.stroke();
}

export function text(ctx, t, x, y, px, color = '#fff', weight = 600, font = FONT, align = 'center', baseline = 'middle') {
	ctx.fillStyle = color;
	ctx.font = `${weight} ${Math.round(px)}px ${font}`;
	ctx.textAlign = align;
	ctx.textBaseline = baseline;
	ctx.fillText(t, x, y);
}

/** Text with a soft dark halo so it reads over bright sky and sea. */
export function shadowText(ctx, t, x, y, px, color, weight = 700, font = FONT, align = 'center', baseline = 'middle') {
	ctx.shadowColor = 'rgba(0,0,0,0.75)';
	ctx.shadowBlur = 4;
	text(ctx, t, x, y, px, color, weight, font, align, baseline);
	ctx.shadowBlur = 0;
}

export function gradient(g, stops) {
	stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
	return g;
}

export function panel(ctx, x, y, w, h, r, fill, stroke, width = 1.5) {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
	ctx.fill();
	if (stroke) {
		ctx.strokeStyle = stroke;
		ctx.lineWidth = width;
		ctx.stroke();
	}
}

/** Break `t` into lines no wider than `maxW` in the current font. */
export function wrapText(ctx, t, maxW) {
	const lines = [];
	let cur = '';
	for (const w of t.split(' ')) {
		const next = cur ? `${cur} ${w}` : w;
		if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
	}
	if (cur) lines.push(cur);
	return lines;
}
