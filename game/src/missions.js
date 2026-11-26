// Mission runtime: sets up a sortie from the catalogue, follows each physics step (rings threaded,
// gate and touchdown, crates under canopy drifting onto village marks, mail stops), and grades it.
import { DEG, length, quatRotate } from './math3d.js';
import { layRingCourse, makeRing, ringCrossing } from './rings.js';
import { medalFor, scoreLanding } from './landing-score.js';
import { VILLAGES, findStrip, stripDirection } from './world-layout.js';
import { MISSIONS, RING_ANCHORS, approachGeometry, glidePathPoint } from './mission-catalog.js';

export { MISSIONS, approachGeometry, glidePathPoint };

export function formatTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

const timeMedal = (t, medals) => (t <= medals[0] ? 'gold' : t <= medals[1] ? 'silver' : 'bronze');
const stripMark = (s) => ({ pos: [s.x, s.elev, s.z], label: s.name.toUpperCase() });
const headingTo = (from, to) => Math.atan2(to[0] - from[0], -(to[2] - from[2]));

/** A flat, open meadow near a village for a drop mark. */
function flatSpotNear(world, x, z) {
  for (let r = 60; r < 600; r += 30) {
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6 + r * 0.01, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const s = world.surfaceAt(px, pz);
      if (s.kind === 'meadow' && s.flat > 0.93 && world.terrain.forestAt(px, pz) < 0.4) return [px, s.height, pz];
    }
  }
  return [x, world.terrain.heightAt(x, z), z];
}

export function startMission(def, world) {
  Object.assign(world.wind, def.wind);
  const run = {
    def, time: 0, status: 'running', result: null, messages: [], sounds: [], rings: [], gate: null, targets: [],
    crates: [], cratesLeft: 0, ringIndex: 0, targetIndex: 0, stopIndex: 0, holdTimer: 0, firstTouchdown: null, waypoint: null, delivered: [],
  };
  run.say = (text, color = '#ffffff', seconds = 2.5) => run.messages.push({ text, color, seconds });
  if (def.kind === 'landing') {
    const geo = (run.geo = approachGeometry(def.strip, def.sign));
    const gatePos = glidePathPoint(geo, def.gate || 750, def.aim);
    run.gate = makeRing(gatePos, geo.heading, -3.2);
    run.start = { pos: glidePathPoint(geo, 2500, def.aim), heading: geo.heading * DEG, pitch: DEG, speed: 41, throttle: 0.32, flaps: 1, fuel: 0.5 };
    run.waypoint = { pos: gatePos, label: 'GATE' };
  } else if (def.kind === 'rings') {
    run.rings = layRingCourse(RING_ANCHORS, world.terrain.heightAt);
    const r0 = run.rings[0], n = r0.normal;
    run.start = { pos: [r0.pos[0] - n[0] * 650, r0.pos[1] + 10, r0.pos[2] - n[2] * 650], heading: Math.atan2(n[0], -n[2]), speed: 50, throttle: 0.75, fuel: 0.8 };
    run.waypoint = { pos: r0.pos, label: 'RING 1' };
  } else if (def.kind === 'drop') {
    run.targets = ['kelp', 'harbour', 'emberv'].map((id) => {
      const v = VILLAGES.find((vv) => vv.id === id);
      return { name: v.name, pos: flatSpotNear(world, v.x, v.z), done: false, score: 0, dist: null };
    });
    run.cratesLeft = 4;
    const p = [1500, 170, 250], t0 = run.targets[0].pos;
    run.start = { pos: p, heading: headingTo(p, t0), speed: 46, throttle: 0.6, fuel: 0.7 };
    run.waypoint = { pos: t0, label: 'DROP' };
  } else {
    const port = findStrip('port'), d = stripDirection(port), back = port.length / 2 - 40;
    run.start = { pos: [port.x - d[0] * back, port.elev + 1.35, port.z - d[2] * back], heading: port.heading * DEG, flaps: 1, fuel: def.fuel || 0.75, onGround: true };
    if (def.kind === 'mail') run.waypoint = stripMark(findStrip(def.stops[0]));
  }
  return run;
}

function finish(run, success, result) {
  run.status = success ? 'success' : 'failed';
  run.result = { success, ...result };
}

function updateRings(run, ac) {
  const ring = run.rings[run.ringIndex];
  const c = ring && ringCrossing(ring, run.prevPos, ac.pos);
  if (c === 'miss') run.say('Missed the ring: circle back', '#ff8a6b');
  if (c !== 'pass') return;
  ring.passed = true;
  run.sounds.push('ring');
  const n = run.rings.length, i = ++run.ringIndex, md = run.def.medals;
  if (i < n) {
    run.say(`RING ${i} / ${n}`, '#ffd36b', 1.4);
    run.waypoint = { pos: run.rings[i].pos, label: `RING ${i + 1}` };
    return;
  }
  finish(run, true, {
    medal: timeMedal(run.time, md), headline: `Course complete in ${formatTime(run.time)}`,
    lines: [`Time ${formatTime(run.time)}  (gold under ${formatTime(md[0])}, silver under ${formatTime(md[1])})`, `Peak load ${ac.maxG.toFixed(1)} g, damage ${Math.round(ac.damage)}%`, `Fuel left ${Math.round(ac.fuel)} L`],
  });
}

function updateLanding(run, ac, world) {
  const gate = run.gate;
  if (!gate.passed && ringCrossing(gate, run.prevPos, ac.pos) === 'pass') {
    gate.passed = true;
    run.sounds.push('ring');
    run.say('Gate threaded: stabilise and land', '#ffd36b');
    run.waypoint = { pos: run.geo.threshold, label: 'THRESHOLD' };
  }
  if (ac.onGround && !run.firstTouchdown && ac.touchdown) run.firstTouchdown = ac.touchdown;
  if (!run.firstTouchdown || !ac.onGround || length(ac.vel) > 1.2) return;
  const surf = world.surfaceAt(ac.pos[0], ac.pos[2]);
  const res = scoreLanding(run.firstTouchdown, run.def.strip, run.def.sign, run.def.zone, !!surf.strip && surf.strip.id === run.def.strip);
  res.lines.unshift(gate.passed ? 'Approach gate threaded' : 'Approach gate missed  (-10)');
  if (!gate.passed) res.score = Math.max(0, res.score - 10);
  const onStrip = res.fromThreshold !== null, ok = onStrip && res.score >= 40;
  const headline = !onStrip ? 'Landed off the strip' : `Landing scored ${res.score} / 100${ok ? '' : ': not good enough'}`;
  finish(run, ok, { medal: medalFor(res.score), score: res.score, headline, lines: res.lines });
}

function updateCrate(run, c, world, dt) {
  c.t += dt;
  if (c.t > 0.9) {
    // the canopy opens and the crate drifts with the wind toward a 7 m/s descent
    const wind = world.windAt(c.pos, run.time);
    c.chute = Math.min(1, c.chute + dt * 1.5);
    c.vel[0] += (wind[0] - c.vel[0]) * 0.9 * c.chute * dt;
    c.vel[2] += (wind[2] - c.vel[2]) * 0.9 * c.chute * dt;
    c.vel[1] += (-7 - c.vel[1]) * 1.6 * c.chute * dt;
  }
  c.vel[1] -= 9.81 * dt * (1 - c.chute * 0.9);
  for (let i = 0; i < 3; i++) c.pos[i] += c.vel[i] * dt;
  const g = world.surfaceAt(c.pos[0], c.pos[2]).height;
  if (c.pos[1] > g + 0.5) return;
  c.landed = true;
  c.pos[1] = g + 0.5;
  const t = run.targets[run.targetIndex];
  if (!t) return;
  const dist = Math.hypot(c.pos[0] - t.pos[0], c.pos[2] - t.pos[2]);
  if (dist >= 150) {
    run.say(`Crate lost ${Math.round(dist)} m wide`, '#ff8a6b');
    return;
  }
  Object.assign(t, { done: true, dist, score: Math.max(0, Math.round(100 - dist * 1.6)) });
  run.say(`${t.name}: ${Math.round(dist)} m from the mark  (+${t.score})`, dist < 15 ? '#ffd36b' : '#ffffff', 3);
  run.sounds.push(dist < 15 ? 'ring' : 'thud');
  const next = run.targets[++run.targetIndex];
  run.waypoint = next ? { pos: next.pos, label: 'DROP' } : null;
}

function updateDrop(run, ac, world, dt, drop) {
  if (drop && run.cratesLeft > 0 && !ac.onGround) {
    run.cratesLeft--;
    const d = quatRotate(ac.q, [0, -1.6, 0.8]);
    run.crates.push({ pos: [ac.pos[0] + d[0], ac.pos[1] + d[1], ac.pos[2] + d[2]], vel: [...ac.vel], t: 0, chute: 0, landed: false });
    run.sounds.push('drop');
    run.say(`Crate away: ${run.cratesLeft} left`, '#ffffff', 1.5);
  }
  for (const c of run.crates) if (!c.landed) updateCrate(run, c, world, dt);
  const allDone = run.targetIndex >= run.targets.length;
  if (!allDone && (run.cratesLeft > 0 || run.crates.some((c) => !c.landed))) return;
  const total = run.targets.reduce((s, t) => s + t.score, 0), avg = total / run.targets.length;
  finish(run, allDone, {
    medal: avg >= 75 ? 'gold' : avg >= 50 ? 'silver' : avg >= 25 ? 'bronze' : null, score: total,
    headline: allDone ? `All villages supplied: ${total} points` : `Out of crates: ${total} points`,
    lines: run.targets.map((t) => `${t.name}: ${t.done ? `${Math.round(t.dist)} m from the mark  (+${t.score})` : 'no supplies landed'}`),
  });
}

function updateMail(run, ac, world, dt) {
  const surf = world.surfaceAt(ac.pos[0], ac.pos[2]), stops = run.def.stops;
  const here = ac.onGround && length(ac.vel) < 1.5 && surf.strip && surf.strip.id === stops[run.stopIndex];
  run.holdTimer = here ? run.holdTimer + dt : 0;
  if (run.holdTimer < 1.5) return;
  run.holdTimer = 0;
  run.delivered.push({ name: surf.strip.name, time: run.time });
  run.sounds.push('ring');
  if (++run.stopIndex < stops.length) {
    const s = findStrip(stops[run.stopIndex]);
    run.say(`Mailbag delivered: next ${s.name}`, '#ffd36b', 3);
    run.waypoint = stripMark(s);
    return;
  }
  finish(run, true, {
    medal: timeMedal(run.time, run.def.medals), headline: `Mail delivered in ${formatTime(run.time)}`,
    lines: [...run.delivered.map((d) => `${d.name} at ${formatTime(d.time)}`), `Fuel left ${Math.round(ac.fuel)} L, damage ${Math.round(ac.damage)}%`],
  });
}

/** Follow one physics step of the sortie. */
export function updateMission(run, ac, world, dt, actions) {
  if (run.status !== 'running') return;
  run.time += dt;
  if (!run.prevPos) run.prevPos = [...ac.pos];
  if (ac.crashed) return finish(run, false, { crash: ac.crashed, medal: null });
  const k = run.def.kind;
  if (k === 'rings') updateRings(run, ac);
  else if (k === 'landing') updateLanding(run, ac, world);
  else if (k === 'drop') updateDrop(run, ac, world, dt, actions.drop);
  else if (k === 'mail') updateMail(run, ac, world, dt);
  run.prevPos = [...ac.pos];
}

/** Lines for the objective card. */
export function objectiveLines(run, ac) {
  const d = run.def;
  if (d.kind === 'rings') return [`Ring ${Math.min(run.ringIndex + 1, run.rings.length)} of ${run.rings.length}`, `Time ${formatTime(run.time)}`];
  if (d.kind === 'landing') {
    const w = d.wind;
    return [run.gate.passed ? `Land on ${findStrip(d.strip).name} and stop` : 'Fly through the approach gate', `Wind ${String(w.fromDeg).padStart(3, '0')}° at ${Math.round(w.speed * 3.6)} km/h`];
  }
  if (d.kind === 'drop') {
    const t = run.targets[run.targetIndex];
    return [t ? `Drop on ${t.name}  [SPACE]` : 'Crates landing...', `Crates ${run.cratesLeft}   Supplied ${run.targetIndex}/${run.targets.length}`];
  }
  if (d.kind === 'mail') return [`Land and stop at ${findStrip(d.stops[Math.min(run.stopIndex, d.stops.length - 1)]).name}`, `Stop ${run.stopIndex + 1} of ${d.stops.length}`];
  return ['Explore the isles', ac.refuelling ? 'Refuelling...' : 'Stop on any strip to refuel'];
}
