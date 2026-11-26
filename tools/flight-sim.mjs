// Headless flight-model check: runs the game's own world and flight model in Node with a scripted
// pilot and prints a trace, to tune handling without a browser.
//   node tools/flight-sim.mjs [takeoff|turns|approach]
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

const src = (f) => pathToFileURL(resolve(join(import.meta.dirname, '..', 'game', 'src', f))).href;
const { createWorld } = await import(src('world.js'));
const { createAircraft, stepAircraft } = await import(src('flight-model.js'));
const { startMission, MISSIONS } = await import(src('missions.js'));
const { attitudeOf } = await import(src('math3d.js'));

const plan = process.argv[2] || 'turns';
const world = createWorld();
const run = startMission(MISSIONS.find((m) => m.id === (plan === 'approach' ? 'approach' : 'free')), world);
const ac = createAircraft(run.start);
if (plan !== 'approach') ac.throttle = 1;
const dt = 1 / 120;
let airT = null;
const pilot = (t) => {
  if (plan === 'approach') return { pitch: 0, roll: 0, yaw: 0 };
  if (t > 12 && (airT === null || t < airT + 0.6)) return { pitch: 1, roll: 0, yaw: 0 };
  if (plan === 'turns') {
    if (t > 21 && t < 21.5) return { pitch: 0, roll: 1, yaw: 0 };
    if (t > 21.5 && t < 25.5) return { pitch: 0.25, roll: 0, yaw: 0 };
    if (t > 25.5 && t < 26) return { pitch: 0, roll: -1, yaw: 0 };
  }
  return { pitch: 0, roll: 0, yaw: 0 };
};
for (let i = 0; i < 120 * 45 && !ac.crashed; i++) {
  const t = i * dt;
  if (!ac.onGround && airT === null && t > 1) airT = t;
  stepAircraft(ac, pilot(t), world, dt);
  for (const e of ac.events) if (e.type !== 'touchdown') console.log(`  ${t.toFixed(2)} ${e.type}${e.info ? ' ' + e.info.cause : ''}`);
  ac.events.length = 0;
  if (i % 60 === 0) {
    const a = attitudeOf(ac.q);
    console.log(`${t.toFixed(1).padStart(5)} y ${ac.pos[1].toFixed(1).padStart(6)}  kmh ${(ac.airspeed * 3.6).toFixed(0).padStart(4)}  hdg ${(a.heading * 57.3).toFixed(0).padStart(3)}  pitch ${(a.pitch * 57.3).toFixed(1).padStart(5)}  bank ${(a.bank * 57.3).toFixed(0).padStart(4)}  aoa ${(ac.alpha * 57.3).toFixed(1).padStart(5)}  vs ${ac.vel[1].toFixed(1).padStart(5)}  g ${ac.gLoad.toFixed(2)}${ac.onGround ? '  ground' : ''}`);
  }
}
console.log(ac.crashed ? `crashed: ${ac.crashed.cause}` : `ok at ${ac.pos.map((v) => v.toFixed(0)).join(', ')}`);
