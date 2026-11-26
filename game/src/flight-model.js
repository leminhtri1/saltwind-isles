// The Kittiwake flight model: thrust, lift to the stall, drag, controls fading with speed, wheels, fuel and damage.
import {
  DEG, attitudeOf, clamp, cross, damp, dot, length, madd, normalize, quatAxisAngle, quatFromAttitude,
  quatMul, quatNormalize, quatRotate, scale, sub,
} from './math3d.js';
import { GEAR_HEIGHT } from './aircraft-mesh.js';

export const AIRFRAME = {
  mass: 950, wingArea: 16.2, maxThrust: 3300, thrustFadeSpeed: 96, cl0: 0.28, clAlpha: 4.9, flapCl: 0.45, stallAlpha: 15 * DEG,
  cd0: 0.027, induced: 0.05, flapCd: 0.045, fuelCapacity: 90, neverExceed: 74, maxG: 4.4,
};
const G = 9.81;

export function createAircraft({ pos, heading = 0, pitch = 0, bank = 0, speed = 0, throttle = 0, flaps = 0, fuel = 1, onGround = false } = {}) {
  const q = quatFromAttitude(heading, pitch, bank);
  return {
    pos: [...pos], vel: scale(quatRotate(q, [0, 0, -1]), speed), q, rates: { roll: 0, pitch: 0, yaw: 0 }, throttle, flaps, flapAngle: flaps / 2,
    brakes: false, fuel: fuel * AIRFRAME.fuelCapacity, damage: 0, engineOn: true, onGround, crashed: null, time: 0, alpha: 0, beta: 0,
    airspeed: speed, gLoad: 1, maxG: 1, stalled: false, stallWarning: false, overspeed: false, rpm: throttle > 0 ? 700 + 1900 * throttle : 0,
    propAngle: 0, surfaces: { aileron: 0, elevator: 0, rudder: 0 }, lastStall: null, wingDrop: 1, touchdown: null, events: [], refuelling: false,
  };
}

/** Freeze the aircraft and record how it hit: speed, sink, attitude, and the stall or failure behind it. */
function crash(ac, cause, kind) {
  const att = attitudeOf(ac.q);
  ac.crashed = {
    cause, kind, speedKmh: length(ac.vel) * 3.6, vs: ac.vel[1], pitch: att.pitch / DEG, bank: att.bank / DEG, pos: [...ac.pos], time: ac.time,
    stall: ac.lastStall && ac.time - ac.lastStall.time < 10 ? ac.lastStall : null, fuelEmpty: ac.fuel <= 0, engineOut: !ac.engineOn,
  };
  ac.events.push({ type: 'crash', info: ac.crashed });
}

function addDamage(ac, amount, reason) {
  if (amount <= 0) return;
  const before = ac.damage;
  ac.damage = Math.min(100, ac.damage + amount);
  if (Math.floor(before / 25) !== Math.floor(ac.damage / 25)) ac.events.push({ type: 'damage', amount: ac.damage, reason });
  if (ac.damage >= 100 && ac.engineOn) {
    ac.engineOn = false;
    ac.events.push({ type: 'engine-out', reason: 'Engine seized from damage' });
  }
}

/** Advance the aircraft by dt seconds. `input` holds pitch, roll, yaw in [-1, 1] (nose up, right, right). */
export function stepAircraft(ac, input, world, dt) {
  if (ac.crashed) return;
  const A = AIRFRAME;
  ac.time += dt;
  const fwd = quatRotate(ac.q, [0, 0, -1]), up = quatRotate(ac.q, [0, 1, 0]), right = quatRotate(ac.q, [1, 0, 0]);
  const air = sub(ac.vel, world.windAt(ac.pos, ac.time));
  const V = length(air);
  const u = dot(air, fwd), w = dot(air, up), s = dot(air, right);
  const alpha = V > 2 ? Math.atan2(-w, Math.max(u, 0.5)) : 0;
  const beta = V > 2 ? Math.atan2(s, Math.max(u, 0.5)) : 0;
  Object.assign(ac, { alpha, beta, airspeed: V });

  // flaps travel slowly between notches (0, 1, 2)
  ac.flapAngle += clamp(ac.flaps / 2 - ac.flapAngle, -dt * 0.7, dt * 0.7);
  const flap = ac.flapAngle;

  // lift and stall
  const stallAlpha = A.stallAlpha - flap * 1.5 * DEG;
  const clMax = A.cl0 + flap * A.flapCl + A.clAlpha * stallAlpha;
  let cl;
  if (alpha < stallAlpha) cl = Math.max(A.cl0 + flap * A.flapCl + A.clAlpha * alpha, -0.9);
  else cl = clMax * Math.max(0.42, 1 - (alpha - stallAlpha) * 2.6);
  const wasStalled = ac.stalled;
  ac.stalled = !ac.onGround && alpha > stallAlpha && V > 4;
  ac.stallWarning = !ac.onGround && alpha > stallAlpha - 3.5 * DEG && V > 4;
  if (ac.stalled && !wasStalled) {
    const ground = Math.max(0, world.surfaceAt(ac.pos[0], ac.pos[2]).height);
    ac.lastStall = { time: ac.time, alt: ac.pos[1] - ground, speedKmh: V * 3.6 };
    ac.wingDrop = Math.sin(ac.time * 12.9898) > 0 ? 1 : -1;
    ac.events.push({ type: 'stall' });
  }
  const qdyn = 0.5 * 1.225 * V * V;
  const airDir = V > 0.1 ? scale(air, 1 / V) : fwd;
  const liftDir = normalize(cross(right, airDir));
  const lift = qdyn * A.wingArea * cl;
  const cd = A.cd0 + A.induced * cl * cl + flap * A.flapCd + (ac.stalled ? 0.1 : 0) + ac.damage * 0.0004;
  const drag = qdyn * A.wingArea * cd;
  const side = -qdyn * 2.4 * beta;

  // engine, propeller and fuel
  const hasFuel = ac.fuel > 0;
  const running = hasFuel && ac.engineOn;
  let power = running ? ac.throttle : 0;
  if (running && ac.damage > 60) power *= 0.74 + 0.2 * Math.sin(ac.time * 7.3) * Math.sin(ac.time * 2.1);
  ac.rpm += ((running ? 650 : 0) + 1950 * power + V * 9 - ac.rpm) * damp(2.2, dt);
  ac.propAngle = (ac.propAngle + ac.rpm / 60 * Math.PI * 2 * dt) % (Math.PI * 2);
  const thrust = power * A.maxThrust * Math.max(0.12, 1 - V / A.thrustFadeSpeed);
  if (running) ac.fuel = Math.max(0, ac.fuel - (0.012 + 0.2 * power) * dt);
  if (hasFuel && ac.fuel <= 0) ac.events.push({ type: 'fuel-out' });

  const F = [0, -A.mass * G, 0];
  const add = (dir, mag) => { F[0] += dir[0] * mag; F[1] += dir[1] * mag; F[2] += dir[2] * mag; };
  add(liftDir, lift);
  add(airDir, -drag);
  add(right, side);
  add(fwd, thrust);
  ac.gLoad = (dot(F, up) + A.mass * G * up[1]) / (A.mass * G);

  // control response: rate targets scaled by airspeed, prop wash, and stability toward the airflow
  const eff = clamp(V / 30, 0, 1.25);
  const wash = running ? ac.throttle * 0.32 : 0;
  const authority = ac.damage > 80 ? 0.65 : 1;
  // hands off, the nose settles where the wing makes one g: the flight path holds until the pilot
  // pulls (turns need back pressure) or the speed decays toward the stall
  const qS = qdyn * A.wingArea;
  const bankNow = Math.atan2(-right[1], up[1]);
  const needCl = qS > 40 ? (A.mass * G) / (qS * Math.max(0.5, Math.cos(bankNow))) : 3;
  const trimAlpha = ac.onGround ? 0.03 : clamp((needCl - A.cl0 - flap * A.flapCl) / A.clAlpha, -0.06, stallAlpha - 2.5 * DEG);
  let rollT = input.roll * 1.35 * eff * authority;
  if (Math.abs(bankNow) < 0.6 && !input.roll) rollT -= bankNow * 0.25 * eff; // gentle dihedral
  // the stick commands angle of attack around that trim: full back pulls about 3 g at cruise, but at
  // low speed the trim already sits near the stall and full back goes past it
  const wantAlpha = trimAlpha + input.pitch * (input.pitch > 0 ? 0.2 : 0.22) * authority;
  let pitchT = (wantAlpha - alpha) * 3.2 * eff + input.pitch * wash * 0.45;
  const yawT = input.yaw * 0.55 * (eff + wash) + beta * 2.3 * eff;
  if (ac.stalled) {
    pitchT -= 0.3;
    if (alpha > stallAlpha + 1.5 * DEG) rollT += ac.wingDrop * 0.6;
  }
  ac.rates.roll += (rollT - ac.rates.roll) * damp(5, dt);
  ac.rates.pitch += (pitchT - ac.rates.pitch) * damp(5, dt);
  ac.rates.yaw += (yawT - ac.rates.yaw) * damp(4, dt);
  ac.surfaces.aileron += (input.roll - ac.surfaces.aileron) * damp(10, dt);
  ac.surfaces.elevator += (input.pitch - ac.surfaces.elevator) * damp(10, dt);
  ac.surfaces.rudder += (input.yaw - ac.surfaces.rudder) * damp(10, dt);

  // integrate
  ac.vel = madd(ac.vel, F, dt / A.mass);
  ac.pos = madd(ac.pos, ac.vel, dt);
  const omega = [ac.rates.pitch, -ac.rates.yaw, -ac.rates.roll];
  const mag = length(omega);
  if (mag > 1e-6) ac.q = quatNormalize(quatMul(ac.q, quatAxisAngle(scale(omega, 1 / mag), mag * dt)));

  // structural limits
  ac.overspeed = V > A.neverExceed;
  if (ac.overspeed) addDamage(ac, (V - A.neverExceed) * 1.1 * dt, 'overspeed');
  if (ac.gLoad > A.maxG) addDamage(ac, (ac.gLoad - A.maxG) * 8 * dt, 'over-g');
  ac.maxG = Math.max(ac.maxG, ac.gLoad);

  groundContact(ac, input, world, dt, lift);
  if (ac.crashed) return;

  const hit = world.scenery.obstacles.hit(ac.pos[0], ac.pos[1], ac.pos[2], 4.2);
  if (hit) crash(ac, hit.kind === 'tree' ? 'Clipped the treetops' : hit.kind === 'lighthouse' ? 'Struck the lighthouse' : 'Flew into a building', 'obstacle');
  if (ac.pos[1] > 3000) ac.vel[1] = Math.min(ac.vel[1], 0);
}

function groundContact(ac, input, world, dt, lift) {
  const surf = world.surfaceAt(ac.pos[0], ac.pos[2]);
  const groundY = surf.height;
  const pointY = (p) => ac.pos[1] + quatRotate(ac.q, p)[1];
  const wheelY = Math.min(pointY([1.32, -GEAR_HEIGHT, -0.55]), pointY([-1.32, -GEAR_HEIGHT, -0.55]), pointY([0, -GEAR_HEIGHT, -2.72]));
  const tipL = pointY([-5.6, 1.2, -0.7]), tipR = pointY([5.6, 1.2, -0.7]);
  const propY = pointY([0, -0.95, -3.5]), tailY = pointY([0, 0.5, 3.95]), noseY = pointY([0, 0.1, -3.8]);
  const lowest = Math.min(wheelY, tipL, tipR, propY, tailY, noseY);
  if (lowest > groundY + 0.05) {
    if (ac.onGround) ac.events.push({ type: 'liftoff' });
    ac.onGround = false;
        return;
  }
  const att = attitudeOf(ac.q);
  const speed = length(ac.vel);
  if (surf.kind === 'water') {
    crash(ac, speed < 25 && ac.vel[1] > -3 ? 'Ditched in the sea' : 'Plunged into the sea', 'water');
    return;
  }
  const wheelsFirst = wheelY - lowest < 0.25;
  if (!wheelsFirst) {
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
    const vs = ac.vel[1];
    const td = {
      vs, speedKmh: speed * 3.6, bank: att.bank / DEG, pitch: att.pitch / DEG, kind: surf.kind,
      strip: surf.strip ? surf.strip.id : null, along: surf.along, across: surf.across, time: ac.time,
    };
    ac.touchdown = td;
    if (vs < -6) {
      crash(ac, 'Slammed into the ground', 'hard');
      return;
    }
    if (vs < -3) addDamage(ac, (-vs - 3) * 22, 'hard landing');
    if (!surf.strip && speed > 22) addDamage(ac, (speed - 22) * 2.5, 'rough field');
    ac.events.push({ type: 'touchdown', info: td });
  }
  ac.onGround = true;

  // sit on the wheels, keep wings level, nose between the nose wheel and full rotation
  if (wheelY < groundY) ac.pos[1] += groundY - wheelY;
  if (ac.vel[1] < 0) ac.vel[1] = 0;
  const pitch = clamp(att.pitch, 0, 0.24);
  let heading = att.heading;
  const fwdFlat = [Math.sin(heading), 0, -Math.cos(heading)];
  const vf = dot(ac.vel, fwdFlat);
  const steer = (input.yaw + input.roll * 0.6) * 0.7 * clamp(Math.abs(vf) / 5, 0, 1) * clamp(1.5 - Math.abs(vf) / 35, 0.3, 1);
  heading += steer * dt * Math.sign(vf || 1);
  ac.q = quatFromAttitude(heading, pitch, att.bank * (1 - damp(10, dt)));
  ac.rates.roll *= 0.5;
  ac.rates.yaw = 0;
  if (att.pitch <= 0 && ac.rates.pitch < 0) ac.rates.pitch = 0;

  // tyres: grip sideways, roll forwards, brake
  const f2 = [Math.sin(heading), 0, -Math.cos(heading)];
  const s2 = [Math.cos(heading), 0, Math.sin(heading)];
  let along = dot(ac.vel, f2);
  const sideV = dot(ac.vel, s2) * Math.exp(-dt * 9);
  const mu = (surf.kind === 'runway' ? 0.02 : surf.kind === 'strip' ? 0.045 : 0.09) + (ac.brakes ? 0.5 : 0);
  const normal = Math.max(0, G - lift * Math.max(0, quatRotate(ac.q, [0, 1, 0])[1]) / AIRFRAME.mass);
  const decel = mu * normal * dt;
  along = Math.abs(along) <= decel ? 0 : along - Math.sign(along) * decel;
  ac.vel = [f2[0] * along + s2[0] * sideV, ac.vel[1], f2[2] * along + s2[2] * sideV];
  if (!surf.strip && Math.abs(along) > 14) addDamage(ac, (Math.abs(along) - 14) * 0.6 * dt, 'rough ground');
}
