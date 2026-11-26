// Screenshot scenes behind ?shot=<name>: a real mission placed and stepped forward deterministically.
import { DEG, quatFromAttitude, quatRotate, scale } from './math3d.js';
import { MISSIONS, approachGeometry, glidePathPoint } from './mission-catalog.js';
import { landingAutopilot } from './autopilot.js';

const FRAME = 1 / 60;

export function stageShot(name, { game, camera, world, simulate, startMissionAt, finishSortie }) {
	const ac = () => game.ac, index = (id) => MISSIONS.findIndex((m) => m.id === id), start = (id) => startMissionAt(index(id));
	const place = (pos, heading, pitch, bank, speed, props) => {
		Object.assign(ac(), { pos: [...pos], q: quatFromAttitude(heading * DEG, pitch * DEG, bank * DEG), ...props });
		ac().vel = scale(quatRotate(ac().q, [0, 0, -1]), speed);
	};
	const fly = (seconds, input, view = () => camera.follow(ac(), FRAME, null, world.terrain.heightAt)) => {
		for (let t = 0; t < seconds && (!game.run || game.run.status === 'running'); t += FRAME) {
			simulate(FRAME, typeof input === 'function' ? input() : input);
			view();
		}
	};
	game.time = 40;
	if (name === 'board') {
		Object.assign(game, { selected: index('mail'), loadouts: { mail: { fuel: 70, cargo: 120 } }, best: { approach: 'gold', rings: 'silver', drop: 'bronze', shortfield: 'silver' } });
		camera.orbitAngle = 2.2;
		fly(1, { pitch: 0, roll: 0, yaw: 0, throttleSet: 0.05 }, () => camera.orbit(ac().pos, 24, 3, FRAME, 0.1, -1.8, 10));
	} else if (name === 'cockpit') {
		start('shortfield');
		const geo = approachGeometry('gull', 1), p = glidePathPoint(geo, 640, 50);
		camera.mode = 'cockpit';
		place([p[0], p[1] + 3, p[2]], geo.heading + 2, -2, 4, 31, { throttle: 0.34, flaps: 2, flapAngle: 1 });
		fly(0.8, { pitch: 0.05, roll: 0, yaw: 0 });
	} else if (name === 'debrief') {
		start('approach');
		const geo = approachGeometry('port', -1);
		place(glidePathPoint(geo, 1300, 300), geo.heading, 0, 0, 48.5, { throttle: 0.3, flaps: 2, flapAngle: 1 });
		fly(120, () => landingAutopilot(ac(), geo, { flareAgl: 4, sink: 2, offset: 2.4 }), () => {});
		camera.orbitAngle = 0.6;
		camera.orbit(ac().pos, 30, 7, 1, 0.1);
		finishSortie();
	} else {
		start('approach');
		const geo = approachGeometry('port', -1), p = glidePathPoint(geo, 720, 300);
		place([p[0] - geo.dir[2] * 6, p[1] + 8, p[2] + geo.dir[0] * 6], geo.heading - 3, -1, -12, 40, { throttle: 0.4 });
		fly(0.6, { pitch: 0.04, roll: 0, yaw: 0 });
	}
}
