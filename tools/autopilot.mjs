// A landing autopilot for demonstrations and tests: holds the 3.2° path and centreline, slows on final, flares near the ground.
import { attitudeOf } from '../game/src/math3d.js';

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

export function landingAutopilot(ac, geo, { flareAgl = 6, sink = 0.6, offset = 0, targetSpeed = 32 } = {}) {
	const d = geo.dir, rel = [ac.pos[0] - geo.threshold[0], ac.pos[2] - geo.threshold[2]];
	const along = -(rel[0] * d[0] + rel[1] * d[2]), cross = rel[0] * -d[2] + rel[1] * d[0] - offset;
	const agl = ac.pos[1] - 1.35 - geo.strip.elev, a = attitudeOf(ac.q);
	const wantVs = agl < flareAgl ? -sink : Math.max(-4, Math.min(1, ((along + 300) * 0.056 - agl) * 0.12 - 2.2));
	ac.throttle = agl < 4 ? 0 : Math.max(0, Math.min(1, ac.throttle + (targetSpeed - ac.airspeed) * 0.002));
	ac.flaps = 2;
	ac.brakes = ac.onGround;
	const wantBank = Math.max(-0.35, Math.min(0.35, -cross * 0.01 - Math.sin(a.heading - geo.heading * Math.PI / 180) * 1.5));
	return { pitch: clamp1((wantVs - ac.vel[1]) * 0.35), roll: clamp1((wantBank - a.bank) * 2), yaw: 0, brakes: ac.onGround };
}
