// North-up chart of the archipelago, painted once from the heightfield, with live aircraft, rings, drop marks and waypoint.
import { STRIPS, WORLD_HALF, stripDirection } from './world-layout.js';

export class Minimap {
	constructor(world, size = 512) {
		const c = Object.assign(document.createElement('canvas'), { width: size, height: size }), ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
		for (let j = 0; j < size; j++) {
			for (let i = 0; i < size; i++) {
				const x = ((i + 0.5) / size * 2 - 1) * WORLD_HALF, z = ((j + 0.5) / size * 2 - 1) * WORLD_HALF, h = world.terrain.heightAt(x, z);
				const t = 1 - Math.min(1, -h / 18), f = h > 2.5 && h < 200 ? world.terrain.forestAt(x, z) : 0, shade = 1 - h / 500;
				const col = h < 0 ? [40 + t * 60, 110 + t * 70, 140 + t * 30] : h < 2.5 ? [222, 200, 150] : h > 200 ? [150, 145, 135] : [(120 - f * 50) * shade, (160 - f * 40) * shade, (80 - f * 30) * shade];
				img.data.set([...col, 255], (j * size + i) * 4);
			}
		}
		ctx.putImageData(img, 0, 0);
		ctx.lineCap = 'round';
		for (const s of STRIPS) {
			const d = stripDirection(s), p = (a) => this.toMap(s.x + d[0] * a, s.z + d[2] * a, size);
			Object.assign(ctx, { strokeStyle: s.surface === 'asphalt' ? '#202022' : '#f5f0d0', lineWidth: s.surface === 'asphalt' ? 8 : 6 });
			ctx.beginPath();
			ctx.moveTo(...p(-s.length / 2));
			ctx.lineTo(...p(s.length / 2));
			ctx.stroke();
		}
		Object.assign(this, { size, base: c });
	}

	toMap(x, z, s) {
		return [(x / WORLD_HALF + 1) / 2 * s, (z / WORLD_HALF + 1) / 2 * s];
	}

	draw(ctx, cx, cy, R, ac, run) {
		const M = (p) => this.toMap(p[0], p[2], R * 2).map((v) => v - R), dot = (p, r, fill, stroke) => {
			ctx.beginPath();
			ctx.arc(...M(p), r, 0, Math.PI * 2);
			if (fill) Object.assign(ctx, { fillStyle: fill }).fill();
			if (stroke) Object.assign(ctx, { strokeStyle: stroke, lineWidth: 2 }).stroke();
		};
		ctx.save();
		ctx.translate(cx, cy);
		ctx.beginPath();
		ctx.arc(0, 0, R, 0, Math.PI * 2);
		ctx.clip();
		ctx.drawImage(this.base, -R, -R, R * 2, R * 2);
		run.rings.forEach((r, i) => r.passed || dot(r.pos, i === run.ringIndex ? 3.5 : 2.2, i === run.ringIndex ? '#ffb02e' : 'rgba(110, 220, 255, 0.9)'));
		for (const t of run.targets) if (!t.done) dot(t.pos, 4, null, '#ff7a2e');
		if (run.waypoint) dot(run.waypoint.pos, 6, null, '#ff5ad1');
		ctx.translate(...M(ac.pos));
		ctx.rotate(ac.headingRad);
		ctx.beginPath();
		[[0, -8], [5.5, 6], [0, 3], [-5.5, 6]].forEach((p) => ctx.lineTo(...p));
		ctx.closePath();
		Object.assign(ctx, { fillStyle: '#fff', strokeStyle: '#000', lineWidth: 1.5 });
		ctx.fill();
		ctx.stroke();
		ctx.restore();
		Object.assign(ctx, { strokeStyle: 'rgba(125, 255, 168, 0.6)', lineWidth: 2.5 });
		ctx.beginPath();
		ctx.arc(cx, cy, R, 0, Math.PI * 2);
		ctx.stroke();
		Object.assign(ctx, { fillStyle: '#ffd36b', font: `800 ${Math.round(R * 0.16)}px "Segoe UI", Arial, sans-serif`, textAlign: 'center', textBaseline: 'middle' });
		ctx.fillText('N', cx, cy - R * 0.87);
	}
}
