// Screenshot scenes behind ?shot=<name>: a real mission placed and stepped forward deterministically.
import { DEG, quatFromAttitude, quatRotate, scale } from './math3d.js';
import { MISSIONS, approachGeometry, glidePathPoint } from './missions.js';

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
	if (name === 'title') {
		camera.orbitAngle = 2.2;
		for (let t = 0; t < 1; t += FRAME) {
			api.simulate(FRAME, { ...idle, throttleSet: 0.05 });
			camera.orbit(game.ac.pos, 24, 3, FRAME, 0.1, -1.8, 10);
		}
	} else if (name === 'rings') {
		api.startMissionAt(missionIndex('rings'));
		const r = game.run;
		for (let i = 0; i < 6; i++) r.rings[i].passed = true;
		r.ringIndex = 6;
		r.time = 71.4;
		r.waypoint = { pos: r.rings[6].pos, label: 'RING 7' };
		const ring = r.rings[6];
		const p = [ring.pos[0] - ring.normal[0] * 230, ring.pos[1] - 4, ring.pos[2] - ring.normal[2] * 230];
		const heading = Math.atan2(ring.normal[0], -ring.normal[2]) / DEG;
		place(game.ac, p, heading - 9, 2, 22, 52);
		game.ac.throttle = 0.8;
		run(api, 0.5, { pitch: 0.15, roll: 0, yaw: 0 });
		game.message = { text: 'RING 6 / 14', color: '#ffd36b', left: 1 };
	} else if (name === 'drop') {
		api.startMissionAt(missionIndex('drop'));
		const r = game.run;
		const t = r.targets[0].pos;
		// the zone's smoke flare has been burning for a while
		for (let s = 0; s < 5; s += FRAME) {
			api.effects.flare(t);
			api.effects.update(FRAME, api.world.windAt(t, s));
		}
		const p = [t[0] + 300, t[1] + 85, t[2] - 210];
		const heading = Math.atan2(t[0] - p[0], -(t[2] - p[2])) / DEG;
		place(game.ac, p, heading - 16, -2, 14, 37);
		game.ac.throttle = 0.38;
		game.ac.flaps = 1;
		game.ac.flapAngle = 0.5;
		// the first crate went out on the previous pass and drifts down under its canopy
		const f = quatRotate(game.ac.q, [0, 0, -1]);
		r.crates.push({ pos: [p[0] + f[0] * 75 + f[2] * 26, p[1] - 22, p[2] + f[2] * 75 - f[0] * 26], vel: [-2, -7, 3], t: 4, chute: 1, landed: false, target: 0 });
		r.cratesLeft = 3;
		run(api, 0.4, { pitch: 0.05, roll: 0.1, yaw: 0 });
		game.message = { text: 'Crate away: 3 left', color: '#ffffff', left: 1 };
	} else if (name === 'debrief') {
		api.startMissionAt(missionIndex('approach'));
		const geo = approachGeometry('port', -1);
		const p = glidePathPoint(geo, -350, 300);
		place(game.ac, [p[0] - geo.dir[2] * 170, geo.strip.elev + 85, p[2] + geo.dir[0] * 170], geo.heading + 20, 22, 5, 21);
		game.ac.throttle = 0;
		game.run.gate.passed = true;
		for (let t = 0; t < 30 && !game.ac.crashed; t += FRAME) api.simulate(FRAME, { pitch: 1, roll: 0.3, yaw: 0.4 });
		for (let t = 0; t < 3.5; t += FRAME) {
			api.simulate(FRAME, idle);
			camera.orbit(game.ac.crashed ? game.ac.crashed.pos : game.ac.pos, 55, 16, FRAME, 0.12, 14);
		}
		api.finishSortie();
	} else {
		// approach: chase view on final, the gate ring ahead and the runway beyond
		api.startMissionAt(missionIndex('approach'));
		const geo = approachGeometry('port', -1);
		const p = glidePathPoint(geo, 1000, 300);
		place(game.ac, [p[0], p[1] + 12, p[2]], geo.heading - 2, -1, 8, 41);
		game.ac.throttle = 0.4;
		run(api, 0.6, { pitch: 0.04, roll: 0, yaw: 0 });
	}
}
