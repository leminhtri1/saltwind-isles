// Screenshot scenes behind ?shot=<name>: a real mission placed and stepped forward deterministically.
import { DEG, quatFromAttitude, quatRotate, scale } from './math3d.js';
import { MISSIONS, approachGeometry, glidePathPoint } from './missions.js';
import { landingAutopilot } from './autopilot.js';

const FRAME = 1 / 60;
const idle = { pitch: 0, roll: 0, yaw: 0 };

function missionIndex(id) {
	return MISSIONS.findIndex((m) => m.id === id);
}

function place(ac, pos, headingDeg, pitchDeg, bankDeg, speed) {
	ac.pos = [...pos];
	ac.q = quatFromAttitude(headingDeg * DEG, pitchDeg * DEG, bankDeg * DEG);
	ac.vel = scale(quatRotate(ac.q, [0, 0, -1]), speed);
}

function run(api, seconds, input = idle) {
	for (let t = 0; t < seconds; t += FRAME) {
		api.simulate(FRAME, input);
		api.camera.follow(api.game.ac, FRAME, null, api.world.terrain.heightAt);
	}
}

export function stageShot(name, api) {
	const { game, camera } = api;
	game.time = 40;
	if (name === 'board') {
		// the sortie board on the mail run, loaded heavy, with a few medals already won
		game.selected = missionIndex('mail');
		game.loadouts.mail = { fuel: 70, cargo: 120 };
		Object.assign(game.best, { approach: 'gold', rings: 'silver', drop: 'bronze', shortfield: 'silver' });
		camera.orbitAngle = 2.2;
		for (let t = 0; t < 1; t += FRAME) {
			api.simulate(FRAME, { ...idle, throttleSet: 0.05 });
			camera.orbit(game.ac.pos, 24, 3, FRAME, 0.1, -1.8, 10);
		}
	} else if (name === 'cockpit') {
		// from the cockpit on short final to Gull Rock's grass strip, the gate just ahead, full flaps
		api.startMissionAt(missionIndex('shortfield'));
		const geo = approachGeometry('gull', 1), p = glidePathPoint(geo, 640, 50);
		camera.mode = 'cockpit';
		place(game.ac, [p[0], p[1] + 3, p[2]], geo.heading + 2, -2, 4, 31);
		Object.assign(game.ac, { throttle: 0.34, flaps: 2, flapAngle: 1 });
		run(api, 0.8, { pitch: 0.05, roll: 0, yaw: 0 });
	} else if (name === 'debrief') {
		// a real landing flown by the autopilot: full flaps dropped too fast, a firm arrival a little off the line, then graded
		api.startMissionAt(missionIndex('approach'));
		const geo = approachGeometry('port', -1), p = glidePathPoint(geo, 1300, 300);
		place(game.ac, p, geo.heading, 0, 0, 45);
		Object.assign(game.ac, { throttle: 0.3, flaps: 2, flapAngle: 1 });
		for (let t = 0; t < 120 && game.run.status === 'running'; t += FRAME) api.simulate(FRAME, landingAutopilot(game.ac, geo, { flareAgl: 4, sink: 2, offset: 2.4 }));
		camera.orbitAngle = 0.6;
		for (let t = 0; t < 1; t += FRAME) camera.orbit(game.ac.pos, 30, 7, FRAME, 0.1, 0, 0);
		api.finishSortie();
	} else {
		// approach: chase view on final, the gate ring ahead and the runway beyond
		api.startMissionAt(missionIndex('approach'));
		const geo = approachGeometry('port', -1);
		const p = glidePathPoint(geo, 720, 300);
		place(game.ac, [p[0] - geo.dir[2] * 6, p[1] + 8, p[2] + geo.dir[0] * 6], geo.heading - 3, -1, -12, 40);
		game.ac.throttle = 0.4;
		run(api, 0.6, { pitch: 0.04, roll: 0, yaw: 0 });
	}
}
