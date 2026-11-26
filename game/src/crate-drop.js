// Supply crates: release from the aircraft, fall, open the canopy and drift with the wind; the drop-aim prediction and its advice.
import { quatRotate } from './math3d.js';

export function stepCrate(c, wind, dt) {
	c.t += dt;
	if (c.t > 0.9) {
		c.chute = Math.min(1, c.chute + dt * 1.5);
		for (const i of [0, 2]) c.vel[i] += (wind[i] - c.vel[i]) * 0.9 * c.chute * dt;
		c.vel[1] += (-7 - c.vel[1]) * 1.6 * c.chute * dt;
	}
	c.vel[1] -= 9.81 * dt * (1 - c.chute * 0.9);
	for (let i = 0; i < 3; i++) c.pos[i] += c.vel[i] * dt;
}

export const newCrate = (ac) => ({ pos: ac.pos.map((p, i) => p + quatRotate(ac.q, [0, -1.6, 0.8])[i]), vel: [...ac.vel], t: 0, chute: 0, landed: false });

export function predictCrateLanding(ac, world, time) {
	const c = newCrate(ac);
	for (let i = 0; i < 400; i++) {
		stepCrate(c, world.windAt(c.pos, time), 0.05);
		if (c.pos[1] <= world.surfaceAt(c.pos[0], c.pos[2]).height) return c.pos;
	}
	return null;
}

export function dropAimText(target, aim, heading) {
	const dx = target.pos[0] - aim[0], dz = target.pos[2] - aim[2], s = Math.sin(heading), c = Math.cos(heading), ahead = dx * s - dz * c, side = dx * c + dz * s;
	return `Crate lands ${Math.round(Math.abs(ahead))} m ${ahead > 0 ? 'short' : 'long'}, ${Math.round(Math.abs(side))} m ${side > 0 ? 'left' : 'right'}`;
}
