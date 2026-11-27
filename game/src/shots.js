// Screenshot scenes behind ?shot=<name>: a real mission placed and stepped forward deterministically.
import { DEG, attitudeOf, quatFromAttitude, quatRotate, scale } from './math3d.js';
import { MISSIONS, approachGeometry, glidePathPoint } from './mission-catalog.js';
import { newCrate } from './crate-drop.js';

const FRAME = 1 / 60;

export function stageShot(name, { game, camera, world, simulate, startMissionAt }) {
	const ac = () => game.ac, start = (id) => startMissionAt(MISSIONS.findIndex((m) => m.id === id)) || game.run;
	const place = (pos, heading, pitch, bank, speed, props) => {
		Object.assign(ac(), { pos: [...pos], q: quatFromAttitude(heading * DEG, pitch * DEG, bank * DEG), ...props });
		ac().vel = scale(quatRotate(ac().q, [0, 0, -1]), speed);
	};
	const fly = (seconds, input) => {
		for (let t = 0; t < seconds; t += FRAME) {
			simulate(FRAME, typeof input === 'function' ? input(attitudeOf(ac().q)) : input);
			camera.follow(ac(), FRAME, null, world.terrain.heightAt);
		}
	};
	game.time = 40;
	if (name === 'cockpit') {
		const run = start('crosswind'), geo = run.geo, p = glidePathPoint(geo, 240, 300);
		camera.mode = 'cockpit';
		place(p, geo.heading + 15, -1, 2, 31, { throttle: 0.3, flaps: 2, flapAngle: 1, fuel: 38 });
		ac().vel = scale(geo.dir, 30);
		Object.assign(run, { time: 74, waypoint: { pos: geo.threshold, label: 'THRESHOLD' } });
		run.gate.passed = true;
		fly(0.5, { pitch: 0.02, roll: -0.05, yaw: 0 });
	} else if (name === 'drop') {
		const run = start('drop'), t = run.targets[0].pos, along = (from, deg, r, y) => [from[0] + Math.sin(deg * DEG) * r, y, from[2] - Math.cos(deg * DEG) * r];
		place(along(t, 2, 280, t[1] + 72), 205, -1, -10, 36, { throttle: 0.45, flaps: 1, fuel: 47, cargo: 135 });
		run.crates.push({ ...newCrate(ac()), pos: along(ac().pos, 191, 70, t[1] + 64), vel: [1, -7, 1], t: 6, chute: 1 });
		run.cratesLeft--;
		run.time = 96;
		fly(0.5, { pitch: 0.05, roll: -0.05, yaw: 0 });
	} else if (name === 'rings') {
		const run = start('rings'), i = 9, { pos: r, normal: n } = run.rings[i], h = Math.atan2(n[0], -n[2]) / DEG;
		run.rings.slice(0, i).forEach((g) => (g.passed = true));
		Object.assign(run, { ringIndex: i, time: 12 * i, waypoint: { pos: r, label: `RING ${i + 1}` } });
		place([r[0] - n[0] * 190 + n[2] * 9, r[1] - 3, r[2] - n[2] * 190 - n[0] * 9], h + 3, 1, 14, 52, { throttle: 0.8, fuel: 52, parts: { engine: 64, gear: 0, flaps: 0, airframe: 18 } });
		fly(1.2, { pitch: 0.05, roll: 0, yaw: 0 });
		Object.assign(camera, { lookYaw: 0.3, offset: null }).follow(ac(), FRAME, { looking: true, lookDx: 0, lookDy: 0 }, world.terrain.heightAt);
	} else {
		const geo = start('approach').geo, p = glidePathPoint(geo, 720, 300);
		place([p[0] - geo.dir[2] * 6, p[1] + 8, p[2] + geo.dir[0] * 6], geo.heading - 3, -1, -20, 40, { throttle: 0.4 });
		game.run.time = 43;
		fly(0.6, { pitch: 0.04, roll: 0, yaw: 0 });
	}
}
