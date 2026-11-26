// Particles that make events readable: fireballs, debris, smoke columns, splashes, tyre smoke, sparkles, flares.
import { createRandom } from './noise.js';

export class Effects {
	constructor(seed = 3) {
		Object.assign(this, { parts: [], emitters: [], rnd: createRandom(seed) });
	}

	clear() {
		this.parts.length = this.emitters.length = 0;
	}

	spawn(p) {
		if (this.parts.length < 1600) this.parts.push({ age: 0, grow: 0, drag: 1, lift: 0, ...p });
	}

	j(s) { return (this.rnd() * 2 - 1) * s; }

	at(pos, dx, dy) { return [pos[0] + this.j(dx), pos[1] + dy, pos[2] + this.j(dx)]; }

	crash(pos, water) {
		const r = () => this.rnd();
		for (let i = 0; i < 40; i++) this.spawn({ pos: [...pos], vel: [this.j(14), 6 + r() * 16, this.j(14)], life: 2 + r() * 2, size: 0.22 + r() * 0.35, color: water ? [0.9, 0.95, 1, 0.9] : [0.12, 0.1, 0.09, 1], kind: 'debris', gravity: 1, drag: 0.4 });
		for (let i = 0; i < (water ? 30 : 18); i++) {
			if (water) this.spawn({ pos: [...pos], vel: [this.j(6), 8 + r() * 10, this.j(6)], life: 1.5 + r(), size: 2.5, grow: 3, color: [0.92, 0.96, 1, 0.8], kind: 'smoke', gravity: 1 });
			else this.spawn({ pos: [...pos], vel: [this.j(8), 3 + r() * 6, this.j(8)], life: 0.9 + r() * 0.6, size: 4 + r() * 3, grow: 6, color: [1, 0.55, 0.15, 1], kind: 'glow' });
		}
		if (!water) this.emitters.push({ pos: [...pos], t: 0 });
	}

	touchdown(pos, grass, strength) {
		for (let i = 0; i < 8 + strength * 6; i++) this.spawn({ pos: this.at(pos, 1.5, 0.3), vel: [this.j(2), 1 + this.rnd() * 1.5, this.j(2)], life: 1.2 + this.rnd(), size: 0.9, grow: 2.2, color: grass ? [0.72, 0.64, 0.45, 0.5] : [0.92, 0.92, 0.92, 0.55], kind: 'smoke' });
	}

	ringBurst(pos) {
		for (let i = 0; i < 36; i++) this.spawn({ pos: [...pos], vel: [Math.cos(i / 5.73) * 14 + this.j(3), Math.sin(i / 5.73) * 14 + this.j(3), this.j(4)], life: 0.9, size: 1.4, color: [1, 0.8, 0.35, 1], kind: 'glow', drag: 2 });
	}

	engineSmoke(pos, vel, damage) {
		if (this.rnd() < (damage - 45) / 40) this.spawn({ pos: [...pos], vel: [vel[0] * 0.2, vel[1] * 0.2 + 0.5, vel[2] * 0.2], life: 2.5, size: 0.8, grow: 2.5, color: [0.25, 0.24, 0.24, 0.45], kind: 'smoke' });
	}

	flare(pos) {
		this.spawn({ pos: this.at(pos, 1, 1), vel: [this.j(0.6), 4 + this.rnd() * 2, this.j(0.6)], life: 5, size: 2, grow: 3.5, color: [1, 0.45, 0.18, 0.6], kind: 'smoke', lift: 0.3 });
	}

	update(dt, wind) {
		for (const e of this.emitters) {
			e.t += dt;
			if (e.t < 25 && this.rnd() < dt * 22) this.spawn({ pos: this.at(e.pos, 2, 1), vel: [this.j(1), 5 + this.rnd() * 3, this.j(1)], life: 6, size: 2.5, grow: 4.5, color: [0.16, 0.15, 0.15, 0.55], kind: 'smoke', lift: 0.4 });
			if (e.t < 12 && this.rnd() < dt * 18) this.spawn({ pos: this.at(e.pos, 2, 0.5), vel: [this.j(1), 2 + this.rnd() * 2, this.j(1)], life: 0.8, size: 2.5, grow: 1, color: [1, 0.5, 0.12, 0.9], kind: 'glow' });
		}
		for (const p of this.parts) {
			const k = Math.exp(-p.drag * dt), v = p.vel;
			p.age += dt;
			v[1] = p.gravity ? v[1] - 9.81 * dt : (v[1] + p.lift * dt) * k;
			for (const i of [0, 2]) v[i] = (v[i] - wind[i]) * k + wind[i];
			for (let i = 0; i < 3; i++) p.pos[i] += v[i] * dt;
		}
		this.parts = this.parts.filter((p) => p.age < p.life);
	}

	draw(smoke, glow, debris, right, up) {
		for (const p of this.parts) {
			const t = p.age / p.life, c = p.color, a = c[3] * (p.kind === 'glow' ? 1 - t : Math.min(1, t * 6) * (1 - t));
			({ glow, smoke, debris })[p.kind].billboard(p.pos, p.size + p.grow * t, p.kind === 'debris' ? c : [c[0], c[1], c[2], a], right, up);
		}
	}
}
