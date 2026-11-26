// The Kittiwake flight model: loaded mass, thrust, lift to the stall, drag, controls fading with speed, wheels, fuel, and engine/gear/flap damage.
import {
	DEG, attitudeOf, clamp, cross, damp, dot, length, madd, normalize, quatAxisAngle, quatFromAttitude,
	quatMul, quatNormalize, quatRotate, scale, sub,
} from './math3d.js';
import { GEAR_HEIGHT } from './aircraft-mesh.js';

export const AIRFRAME = {
	emptyMass: 800, fuelKgPerLitre: 0.72, maxCargo: 240, wingArea: 16.2, maxThrust: 3300, thrustFadeSpeed: 96, cl0: 0.28, clAlpha: 4.9, flapCl: 0.45,
	stallAlpha: 15 * DEG, cd0: 0.027, induced: 0.05, flapCd: 0.045, fuelCapacity: 120, neverExceed: 74, flapLimit: 46, maxG: 4.4,
};
const G = 9.81;

export const worstDamage = (ac) => Math.max(...Object.values(ac.parts));

export function createAircraft({ pos, heading = 0, pitch = 0, bank = 0, speed = 0, throttle = 0, flaps = 0, fuel = 1, cargo = 0, onGround = false } = {}) {
	const q = quatFromAttitude(heading, pitch, bank);
	return {
		pos: [...pos], vel: scale(quatRotate(q, [0, 0, -1]), speed), q, rates: { roll: 0, pitch: 0, yaw: 0 }, throttle, flaps, flapAngle: flaps / 2,
		brakes: false, fuel: fuel * AIRFRAME.fuelCapacity, cargo, parts: { engine: 0, gear: 0, flaps: 0, airframe: 0 }, mass: 0,
		engineOn: true, onGround, crashed: null, time: 0, alpha: 0, beta: 0,
		airspeed: speed, gLoad: 1, maxG: 1, stalled: false, stallWarning: false, overspeed: false, rpm: throttle > 0 ? 700 + 1900 * throttle : 0,
		propAngle: 0, surfaces: { aileron: 0, elevator: 0, rudder: 0 }, lastStall: null, wingDrop: 1, touchdown: null, events: [], refuelling: false,
	};
}

function crash(ac, cause, kind) {
	const att = attitudeOf(ac.q);
	ac.crashed = {
		cause, kind, speedKmh: length(ac.vel) * 3.6, vs: ac.vel[1], pitch: att.pitch / DEG, bank: att.bank / DEG, pos: [...ac.pos], time: ac.time,
		stall: ac.lastStall && ac.time - ac.lastStall.time < 10 ? ac.lastStall : null, fuelEmpty: ac.fuel <= 0, engineOut: !ac.engineOn,
	};
	ac.events.push({ type: 'crash', info: ac.crashed });
}

function addDamage(ac, amount, reason, part = 'airframe') {
	if (amount <= 0) return;
	const before = ac.parts[part], after = (ac.parts[part] = Math.min(100, before + amount));
	if (Math.floor(before / 25) !== Math.floor(after / 25)) ac.events.push({ type: 'damage', part, amount: after, reason });
	if (ac.parts.engine >= 100 && ac.engineOn) {
		ac.engineOn = false;
		ac.events.push({ type: 'engine-out', reason: 'Engine seized from damage' });
	}
}

export function serviceAircraft(ac, dt) {
	const p = ac.parts;
	if (worstDamage(ac) <= 0 && ac.fuel >= AIRFRAME.fuelCapacity) return false;
	ac.fuel = Math.min(AIRFRAME.fuelCapacity, ac.fuel + 9 * dt);
	for (const k in p) p[k] = Math.max(0, p[k] - 4 * dt);
	ac.engineOn = p.engine < 100;
	return true;
}

export function stepAircraft(ac, input, world, dt) {
	if (ac.crashed) return;
	const A = AIRFRAME;
	ac.time += dt;
	const fwd = quatRotate(ac.q, [0, 0, -1]), up = quatRotate(ac.q, [0, 1, 0]), right = quatRotate(ac.q, [1, 0, 0]);
	const air = sub(ac.vel, world.windAt(ac.pos, ac.time));
	const V = length(air);
	const u = dot(air, fwd), w = dot(air, up), s = dot(air, right);
	const alpha = V > 2 ? Math.atan2(-w, Math.max(u, 0.5)) : 0, beta = V > 2 ? Math.atan2(s, Math.max(u, 0.5)) : 0;
	Object.assign(ac, { alpha, beta, airspeed: V });

	ac.mass = A.emptyMass + ac.fuel * A.fuelKgPerLitre + ac.cargo;
	if (ac.parts.flaps < 100) ac.flapAngle += clamp(ac.flaps / 2 - ac.flapAngle, -dt * 0.7, dt * 0.7);
	const flap = ac.flapAngle;

	const stallAlpha = A.stallAlpha - flap * 1.5 * DEG;
	const clMax = A.cl0 + flap * A.flapCl + A.clAlpha * stallAlpha;
	const cl = alpha < stallAlpha ? Math.max(A.cl0 + flap * A.flapCl + A.clAlpha * alpha, -0.9) : clMax * Math.max(0.42, 1 - (alpha - stallAlpha) * 2.6);
	const wasStalled = ac.stalled;
	ac.stalled = !ac.onGround && alpha > stallAlpha && V > 4;
	ac.stallWarning = !ac.onGround && alpha > stallAlpha - 3.5 * DEG && V > 4;
	if (ac.stalled && !wasStalled) {
		const ground = Math.max(0, world.surfaceAt(ac.pos[0], ac.pos[2]).height);
		ac.lastStall = { time: ac.time, alt: ac.pos[1] - ground, speedKmh: V * 3.6 };
		ac.wingDrop = Math.sin(ac.time * 12.9898) > 0 ? 1 : -1;
		ac.events.push({ type: 'stall' });
	}
	const qdyn = 0.5 * 1.225 * V * V, qS = qdyn * A.wingArea, airDir = V > 0.1 ? scale(air, 1 / V) : fwd;
	const lift = qS * cl, cd = A.cd0 + A.induced * cl * cl + flap * A.flapCd + (ac.stalled ? 0.1 : 0) + ac.parts.airframe * 0.0004;

	const hasFuel = ac.fuel > 0, running = hasFuel && ac.engineOn;
	let power = running ? ac.throttle * (1 - ac.parts.engine / 250) : 0;
	if (running && ac.parts.engine > 55) power *= 0.8 + 0.2 * Math.sin(ac.time * 7.3) * Math.sin(ac.time * 2.1);
	ac.rpm += ((running ? 650 : 0) + 1950 * power + V * 9 - ac.rpm) * damp(2.2, dt);
	ac.propAngle = (ac.propAngle + ac.rpm / 60 * Math.PI * 2 * dt) % (Math.PI * 2);
	const thrust = power * A.maxThrust * Math.max(0.12, 1 - V / A.thrustFadeSpeed);
	if (running) ac.fuel = Math.max(0, ac.fuel - (0.012 + 0.2 * power) * dt);
	if (hasFuel && ac.fuel <= 0) ac.events.push({ type: 'fuel-out' });

	const M = ac.mass, F = [0, -M * G, 0];
	for (const [dir, mag] of [[normalize(cross(right, airDir)), lift], [airDir, -qS * cd], [right, -qdyn * 2.4 * beta], [fwd, thrust]]) {
		for (let i = 0; i < 3; i++) F[i] += dir[i] * mag;
	}
	ac.gLoad = (dot(F, up) + M * G * up[1]) / (M * G);

	const eff = clamp(V / 30, 0, 1.25), wash = running ? ac.throttle * 0.32 : 0, authority = ac.parts.airframe > 80 ? 0.65 : 1;
	const bankNow = Math.atan2(-right[1], up[1]);
	const needCl = qS > 40 ? (M * G) / (qS * Math.max(0.5, Math.cos(bankNow))) : 3;
	const trimAlpha = ac.onGround ? 0.03 : clamp((needCl - A.cl0 - flap * A.flapCl) / A.clAlpha, -0.06, stallAlpha - 2.5 * DEG);
	let rollT = input.roll * 1.35 * eff * authority;
	if (Math.abs(bankNow) < 0.6 && !input.roll) rollT -= bankNow * 0.25 * eff; // gentle dihedral
	const wantAlpha = trimAlpha + input.pitch * (input.pitch > 0 ? 0.2 : 0.22) * authority;
	let pitchT = (wantAlpha - alpha) * 3.2 * eff + input.pitch * wash * 0.45;
	const yawT = input.yaw * 0.55 * (eff + wash) + beta * 2.3 * eff;
	if (ac.stalled) {
		pitchT -= 0.3;
		if (alpha > stallAlpha + 1.5 * DEG) rollT += ac.wingDrop * 0.6;
	}
	const R = ac.rates, S = ac.surfaces;
	R.roll += (rollT - R.roll) * damp(5, dt);
	R.pitch += (pitchT - R.pitch) * damp(5, dt);
	R.yaw += (yawT - R.yaw) * damp(4, dt);
	for (const [k, v] of [['aileron', input.roll], ['elevator', input.pitch], ['rudder', input.yaw]]) S[k] += (v - S[k]) * damp(10, dt);

	ac.vel = madd(ac.vel, F, dt / M);
	ac.pos = madd(ac.pos, ac.vel, dt);
	const omega = [R.pitch, -R.yaw, -R.roll], mag = length(omega);
	if (mag > 1e-6) ac.q = quatNormalize(quatMul(ac.q, quatAxisAngle(scale(omega, 1 / mag), mag * dt)));

	ac.overspeed = V > A.neverExceed || (flap > 0.1 && V > A.flapLimit);
	if (V > A.neverExceed) {
		addDamage(ac, (V - A.neverExceed) * 1.1 * dt, 'overspeed');
		addDamage(ac, (V - A.neverExceed) * 1.6 * dt, 'propeller over-revving', 'engine');
	}
	if (flap > 0.1 && V > A.flapLimit) addDamage(ac, (V - A.flapLimit) * 2.5 * flap * dt, 'flaps out too fast', 'flaps');
	if (ac.gLoad > A.maxG) addDamage(ac, (ac.gLoad - A.maxG) * 8 * dt, 'over-g');
	ac.maxG = Math.max(ac.maxG, ac.gLoad);

	groundContact(ac, input, world, dt, lift);
	if (ac.crashed) return;

	const hit = world.scenery.obstacles.hit(ac.pos[0], ac.pos[1], ac.pos[2], 4.2);
	if (hit) crash(ac, hit.kind === 'tree' ? 'Clipped the treetops' : hit.kind === 'lighthouse' ? 'Struck the lighthouse' : 'Flew into a building', 'obstacle');
	if (ac.pos[1] > 3000) ac.vel[1] = Math.min(ac.vel[1], 0);
}

function groundContact(ac, input, world, dt, lift) {
	const surf = world.surfaceAt(ac.pos[0], ac.pos[2]), groundY = surf.height;
	const pointY = (p) => ac.pos[1] + quatRotate(ac.q, p)[1];
	const gearY = ac.parts.gear >= 100 ? -0.62 : -GEAR_HEIGHT; // collapsed gear leaves the plane on its belly
	const wheelY = Math.min(pointY([1.32, gearY, -0.55]), pointY([-1.32, gearY, -0.55]), pointY([0, gearY, -2.72]));
	const tipL = pointY([-5.6, 1.2, -0.7]), tipR = pointY([5.6, 1.2, -0.7]);
	const propY = pointY([0, -0.95, -3.5]), tailY = pointY([0, 0.5, 3.95]), noseY = pointY([0, 0.1, -3.8]);
	const lowest = Math.min(wheelY, tipL, tipR, propY, tailY, noseY);
	if (lowest > groundY + 0.05) {
		if (ac.onGround) ac.events.push({ type: 'liftoff' });
		ac.onGround = false;
		return;
	}
	const att = attitudeOf(ac.q), speed = length(ac.vel);
	if (surf.kind === 'water') {
		crash(ac, speed < 25 && ac.vel[1] > -3 ? 'Ditched in the sea' : 'Plunged into the sea', 'water');
		return;
	}
	if (wheelY - lowest > 0.25) {
		const part = lowest === tipL || lowest === tipR ? 'wingtip' : lowest === tailY ? 'tail' : 'nose';
		if (part === 'tail' && ac.vel[1] > -2.5 && speed < 45) {
			addDamage(ac, 12, 'tail strike');
			ac.events.push({ type: 'tail-strike' });
		} else {
			const terrainName = surf.kind === 'rock' ? 'the hillside' : surf.strip ? 'the runway' : 'the ground';
			const what = part === 'wingtip' ? `Wingtip caught ${terrainName}` : part === 'tail' ? `Tail slammed into ${terrainName}` : `Nose-first into ${terrainName}`;
			crash(ac, what, 'impact');
			return;
		}
	}
	if (surf.kind === 'rock' || (surf.flat !== undefined && surf.flat < 0.72)) {
		crash(ac, ac.onGround ? 'Rolled into rough slope' : 'Flew into the hillside', 'terrain');
		return;
	}
	if (!ac.onGround) {
		const vs = ac.vel[1], td = {
			vs, speedKmh: speed * 3.6, bank: att.bank / DEG, pitch: att.pitch / DEG, kind: surf.kind,
			strip: surf.strip ? surf.strip.id : null, along: surf.along, across: surf.across, time: ac.time,
		};
		ac.touchdown = td;
		if (vs < -6) return crash(ac, 'Slammed into the ground', 'hard');
		if (vs < -2.4) addDamage(ac, (-vs - 2.4) * 30, 'hard landing', 'gear');
		if (vs < -3.5) addDamage(ac, (-vs - 3.5) * 15, 'hard landing');
		if (!surf.strip && speed > 22) addDamage(ac, (speed - 22) * 2.5, 'rough field', 'gear');
		ac.events.push({ type: 'touchdown', info: td });
	}
	ac.onGround = true;

	if (wheelY < groundY) ac.pos[1] += groundY - wheelY;
	if (ac.vel[1] < 0) ac.vel[1] = 0;
	let heading = att.heading;
	const vf = dot(ac.vel, [Math.sin(heading), 0, -Math.cos(heading)]);
	const pull = ac.parts.gear > 30 && ac.parts.gear < 100 ? ac.parts.gear / 400 : 0;
	const steer = (input.yaw + input.roll * 0.6 + pull) * 0.7 * clamp(Math.abs(vf) / 5, 0, 1) * clamp(1.5 - Math.abs(vf) / 35, 0.3, 1);
	heading += steer * dt * Math.sign(vf || 1);
	ac.q = quatFromAttitude(heading, clamp(att.pitch, 0, 0.24), att.bank * (1 - damp(10, dt)));
	ac.rates.roll *= 0.5;
	ac.rates.yaw = 0;
	if (att.pitch <= 0 && ac.rates.pitch < 0) ac.rates.pitch = 0;

	const f2 = [Math.sin(heading), 0, -Math.cos(heading)], s2 = [Math.cos(heading), 0, Math.sin(heading)];
	let along = dot(ac.vel, f2);
	const sideV = dot(ac.vel, s2) * Math.exp(-dt * 9);
	const belly = ac.parts.gear >= 100;
	const mu = belly ? 0.45 : (surf.kind === 'runway' ? 0.02 : surf.kind === 'strip' ? 0.045 : 0.09) + (ac.brakes ? 0.5 : 0);
	const decel = mu * Math.max(0, G - (lift * Math.max(0, quatRotate(ac.q, [0, 1, 0])[1])) / ac.mass) * dt;
	if (belly && Math.abs(along) > 3) addDamage(ac, Math.abs(along) * 0.25 * dt, 'belly slide');
	along = Math.abs(along) <= decel ? 0 : along - Math.sign(along) * decel;
	ac.vel = [f2[0] * along + s2[0] * sideV, ac.vel[1], f2[2] * along + s2[2] * sideV];
	if (!surf.strip && Math.abs(along) > 14) addDamage(ac, (Math.abs(along) - 14) * 0.6 * dt, 'rough ground', 'gear');
}
