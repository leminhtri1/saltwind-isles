// Headless mission check: runs the drop and mail missions' own logic in Node with the aircraft
// placed by hand, to confirm crates score against their marks and mail stops complete.
//   node tools/mission-check.mjs
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

const src = (f) => pathToFileURL(resolve(join(import.meta.dirname, '..', 'game', 'src', f))).href;
const { createWorld } = await import(src('world.js'));
const { createAircraft, stepAircraft } = await import(src('flight-model.js'));
const { startMission, updateMission } = await import(src('missions.js'));
const { MISSIONS } = await import(src('mission-catalog.js'));
const { findStrip } = await import(src('world-layout.js'));
const world = createWorld();
const dt = 1 / 120;

// drop: fly over each mark upwind, release a little early, let the canopy drift
const drop = startMission(MISSIONS.find((m) => m.id === 'drop'), world);
let ac = createAircraft(drop.start);
for (let n = 0; n < 4 && drop.status === 'running'; n++) {
  const t = drop.targets[drop.targetIndex].pos;
  ac = createAircraft({ pos: [t[0] - 60, t[1] + 80, t[2] - 20], heading: Math.PI / 2, speed: 36, throttle: 0.4 });
  for (let i = 0; i < 120 * 30 && drop.status === 'running'; i++) {
    stepAircraft(ac, { pitch: 0, roll: 0, yaw: 0 }, world, dt);
    updateMission(drop, ac, world, dt, { drop: i === 0 });
    if (drop.crates.every((c) => c.landed) && i > 10) break;
  }
  for (const m of drop.messages.splice(0)) console.log('  drop:', m.text);
}
console.log('drop', drop.status, JSON.stringify(drop.result));

// mail: stop on each strip in turn
const mail = startMission(MISSIONS.find((m) => m.id === 'mail'), world);
for (const id of mail.def.stops) {
  const s = findStrip(id);
  ac = createAircraft({ pos: [s.x, s.elev + 1.35, s.z], heading: (s.heading * Math.PI) / 180, onGround: true });
  for (let i = 0; i < 120 * 3; i++) {
    stepAircraft(ac, { pitch: 0, roll: 0, yaw: 0 }, world, dt);
    updateMission(mail, ac, world, dt, {});
  }
  for (const m of mail.messages.splice(0)) console.log('  mail:', m.text);
}
console.log('mail', mail.status, JSON.stringify(mail.result));
