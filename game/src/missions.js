// The sorties: a timed ring course around Gull Rock, a supply drop to three villages, a short-field
// landing, an island mail run on a part-filled tank, a gusty crosswind landing and free flight.
// Each mission sets the start, the wind and the objective, follows the flight and grades it.
import { DEG, dot, length, quatRotate, sub } from './math3d.js';
import { RING_RADIUS, layRingCourse, makeRing, ringCrossing } from './rings.js';
import { medalFor, scoreLanding } from './landing-score.js';
import { VILLAGES, findStrip, stripDirection } from './world-layout.js';

export const MISSIONS = [
  {
    id: 'approach', title: 'Evening Approach', kind: 'landing', strip: 'port', sign: -1, zone: [150, 450], aim: 300,
    wind: { fromDeg: 255, speed: 4, gust: 0.15 },
    brief: 'Thread the approach gate and land on runway 26 at Port Saltwind. Soft, centred, in the zone.',
  },
  {
    id: 'rings', title: 'Gull Rock Gauntlet', kind: 'rings', wind: { fromDeg: 240, speed: 5, gust: 0.2 },
    brief: '14 rings around Lantern Point and Gull Rock, finishing over Port Saltwind. Beat the clock.',
    medals: [150, 185, 1e9],
  },
  {
    id: 'drop', title: 'Lifeline Drop', kind: 'drop', wind: { fromDeg: 230, speed: 6, gust: 0.25 },
    brief: 'Four parachute crates, three villages. Slow down, lead the target, mind the drift.',
  },
  {
    id: 'shortfield', title: 'Gull Rock Short Field', kind: 'landing', strip: 'gull', sign: 1, zone: [0, 120], aim: 50, gate: 600,
    wind: { fromDeg: 30, speed: 5, gust: 0.2 },
    brief: 'A 440 m grass strip on a windy rock. Full flaps, slow and steady, stop before the cliff.',
  },
  {
    id: 'mail', title: 'Island Mail Run', kind: 'mail', stops: ['ember', 'gull', 'port'], fuel: 0.3,
    wind: { fromDeg: 260, speed: 5, gust: 0.2 },
    brief: 'Mail for Ember Key and Gull Rock, then home. Under a third of a tank: refuel when you stop.',
    medals: [300, 420, 1e9],
  },
  {
    id: 'crosswind', title: 'Saltwind Crosswind', kind: 'landing', strip: 'port', sign: 1, zone: [150, 450], aim: 300,
    wind: { fromDeg: 160, speed: 9, gust: 0.45 },
    brief: 'A 32 km/h gusting crosswind across runway 08. Crab in, kick it straight, land on the centreline.',
  },
  {
    id: 'free', title: 'Free Flight', kind: 'free', wind: { fromDeg: 250, speed: 3, gust: 0.15 },
    brief: 'No clock, no cargo. Explore the isles from Port Saltwind; stop on any strip to refuel.',
  },
];

const RING_ANCHORS = [
  { x: 1300, z: 180, agl: 70 }, { x: 2000, z: 420, agl: 60 }, { x: 2600, z: 460, agl: 75 }, { x: 3050, z: -120, agl: 60 },
  { x: 2950, z: -900, agl: 70 }, { x: 2450, z: -1300, agl: 60 }, { x: 1850, z: -2050, agl: 70 }, { x: 2250, z: -2700, agl: 85 },
  { x: 3000, z: -2550, agl: 70 }, { x: 3150, z: -1750, agl: 60 }, { x: 1350, z: -1500, agl: 70 }, { x: 450, z: -950, agl: 90 },
  { x: -150, z: -350, agl: 80 }, { x: 350, z: 330, agl: 45 },
];

/** Landing threshold position and unit approach direction for a strip and landing sense. */
export function approachGeometry(stripId, sign) {
  const s = findStrip(stripId);
  const d0 = stripDirection(s);
  const d = [d0[0] * sign, 0, d0[2] * sign];
  const threshold = [s.x - d[0] * s.length / 2, s.elev, s.z - d[2] * s.length / 2];
  const heading = ((s.heading + (sign < 0 ? 180 : 0)) % 360);
  return { strip: s, dir: d, threshold, heading };
}

/** A point `dist` metres before the threshold on a 3.2° glide path aimed `aim` metres beyond it. */
export function glidePathPoint(geo, dist, aim) {
  const h = geo.strip.elev + (dist + aim) * Math.tan(3.2 * DEG) + 2;
  return [geo.threshold[0] - geo.dir[0] * dist, h, geo.threshold[2] - geo.dir[2] * dist];
}

function flatSpotNear(world, x, z) {
  for (let r = 60; r < 600; r += 30) {
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6 + r * 0.01;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const s = world.surfaceAt(px, pz);
      if (s.kind === 'meadow' && s.flat > 0.93 && world.terrain.forestAt(px, pz) < 0.4) return [px, s.height, pz];
    }
  }
  return [x, world.terrain.heightAt(x, z), z];
}

function timeMedal(t, medals) {
  return t <= medals[0] ? 'gold' : t <= medals[1] ? 'silver' : 'bronze';
}

export function formatTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

export function startMission(def, world) {
  Object.assign(world.wind, def.wind);
  const run = {
    def, time: 0, status: 'running', result: null, messages: [], sounds: [],
    rings: [], gate: null, targets: [], crates: [], cratesLeft: 0, stopIndex: 0, holdTimer: 0,
    firstTouchdown: null, waypoint: null, start: null, delivered: [],
  };
  const say = (text, color = '#ffffff', seconds = 2.5) => run.messages.push({ text, color, seconds });
  run.say = say;

  if (def.kind === 'landing') {
    const geo = approachGeometry(def.strip, def.sign);
    run.geo = geo;
    const gatePos = glidePathPoint(geo, def.gate || 750, def.aim);
    run.gate = makeRing(gatePos, geo.heading, -3.2);
    const p = glidePathPoint(geo, 2500, def.aim);
    run.start = { pos: p, heading: geo.heading * DEG, pitch: 1 * DEG, speed: 41, throttle: 0.32, flaps: 1, fuel: 0.5 };
    run.waypoint = { pos: gatePos, label: 'GATE' };
  } else if (def.kind === 'rings') {
    run.rings = layRingCourse(RING_ANCHORS, world.terrain.heightAt);
    run.ringIndex = 0;
    const r0 = run.rings[0];
    const p = [r0.pos[0] - r0.normal[0] * 650, r0.pos[1] + 10, r0.pos[2] - r0.normal[2] * 650];
    const heading = Math.atan2(r0.normal[0], -r0.normal[2]);
    run.start = { pos: p, heading, pitch: 0, speed: 50, throttle: 0.75, flaps: 0, fuel: 0.8 };
    run.waypoint = { pos: r0.pos, label: 'RING 1' };
  } else if (def.kind === 'drop') {
    const ids = ['kelp', 'harbour', 'emberv'];
    run.targets = ids.map((id) => {
      const v = VILLAGES.find((vv) => vv.id === id);
      return { name: v.name, pos: flatSpotNear(world, v.x, v.z), done: false, score: 0, dist: null };
    });
    run.cratesLeft = 4;
    run.targetIndex = 0;
    const t0 = run.targets[0].pos;
    const p = [1500, 170, 250];
    run.start = { pos: p, heading: Math.atan2(t0[0] - p[0], -(t0[2] - p[2])), pitch: 0, speed: 46, throttle: 0.6, flaps: 0, fuel: 0.7 };
    run.waypoint = { pos: t0, label: 'DROP' };
  } else {
    const port = findStrip('port');
    const d = stripDirection(port);
    const p = [port.x - d[0] * (port.length / 2 - 40), port.elev + 1.35, port.z - d[2] * (port.length / 2 - 40)];
    run.start = { pos: p, heading: port.heading * DEG, pitch: 0, speed: 0, throttle: 0, flaps: 1, fuel: def.fuel || 0.75, onGround: true };
    if (def.kind === 'mail') {
      const s = findStrip(def.stops[0]);
      run.waypoint = { pos: [s.x, s.elev, s.z], label: s.name.toUpperCase() };
    }
  }
  return run;
}

function finish(run, success, result) {
  run.status = success ? 'success' : 'failed';
  run.result = { success, ...result };
}

function updateRings(run, ac, prev) {
  const ring = run.rings[run.ringIndex];
  if (!ring) return;
  const c = ringCrossing(ring, prev, ac.pos);
  if (c === 'pass') {
    ring.passed = true;
    run.ringIndex++;
    run.sounds.push('ring');
    if (run.ringIndex >= run.rings.length) {
      const medal = timeMedal(run.time, run.def.medals);
      finish(run, true, {
        medal, headline: `Course complete in ${formatTime(run.time)}`, score: Math.max(0, Math.round(300 - run.time)),
        lines: [`Time ${formatTime(run.time)}  (gold under ${formatTime(run.def.medals[0])}, silver under ${formatTime(run.def.medals[1])})`, `Peak load ${ac.maxG.toFixed(1)} g, damage ${Math.round(ac.damage)}%`, `Fuel left ${Math.round(ac.fuel)} L`],
      });
    } else {
      run.say(`RING ${run.ringIndex} / ${run.rings.length}`, '#ffd36b', 1.4);
      run.waypoint = { pos: run.rings[run.ringIndex].pos, label: `RING ${run.ringIndex + 1}` };
    }
  } else if (c === 'miss') {
    run.say('Missed the ring: circle back', '#ff8a6b', 2.5);
  }
}

function updateLanding(run, ac, world) {
  if (run.gate && !run.gate.passed && ringCrossing(run.gate, run.prevPos, ac.pos) === 'pass') {
    run.gate.passed = true;
    run.sounds.push('ring');
    run.say('Gate threaded: stabilise and land', '#ffd36b', 2.5);
    run.waypoint = { pos: run.geo.threshold, label: 'THRESHOLD' };
  }
  if (ac.onGround && !run.firstTouchdown && ac.touchdown) run.firstTouchdown = ac.touchdown;
  if (run.firstTouchdown && ac.onGround && length(ac.vel) < 1.2) {
    const surf = world.surfaceAt(ac.pos[0], ac.pos[2]);
    const stopped = !!surf.strip && surf.strip.id === run.def.strip;
    const res = scoreLanding(run.firstTouchdown, run.def.strip, run.def.sign, run.def.zone, stopped);
    if (run.gate) res.lines.unshift(run.gate.passed ? 'Approach gate threaded' : 'Approach gate missed  (-10)');
    if (run.gate && !run.gate.passed) res.score = Math.max(0, res.score - 10);
    res.medal = medalFor(res.score);
    const ok = res.fromThreshold !== null && res.score >= 40;
    finish(run, ok, { medal: res.medal, score: res.score, headline: ok ? `Landing scored ${res.score} / 100` : res.fromThreshold === null ? 'Landed off the strip' : `Landing scored ${res.score} / 100: not good enough`, lines: res.lines });
  }
}

function updateDrop(run, ac, world, dt, drop) {
  if (drop && run.cratesLeft > 0 && !ac.onGround) {
    run.cratesLeft--;
    const down = quatRotate(ac.q, [0, -1.6, 0.8]);
    run.crates.push({ pos: [ac.pos[0] + down[0], ac.pos[1] + down[1], ac.pos[2] + down[2]], vel: [...ac.vel], t: 0, chute: 0, landed: false, target: run.targetIndex });
    run.sounds.push('drop');
    run.say(`Crate away: ${run.cratesLeft} left`, '#ffffff', 1.5);
  }
  for (const c of run.crates) {
    if (c.landed) continue;
    c.t += dt;
    const wind = world.windAt(c.pos, run.time);
    if (c.t > 0.9) {
      c.chute = Math.min(1, c.chute + dt * 1.5);
      const k = 0.9 * c.chute;
      c.vel[0] += (wind[0] - c.vel[0]) * k * dt;
      c.vel[2] += (wind[2] - c.vel[2]) * k * dt;
      c.vel[1] += (-7 - c.vel[1]) * 1.6 * c.chute * dt;
    }
    c.vel[1] -= 9.81 * dt * (1 - c.chute * 0.9);
    c.pos = [c.pos[0] + c.vel[0] * dt, c.pos[1] + c.vel[1] * dt, c.pos[2] + c.vel[2] * dt];
    const g = world.surfaceAt(c.pos[0], c.pos[2]).height;
    if (c.pos[1] <= g + 0.5) {
      c.landed = true;
      c.pos[1] = g + 0.5;
      const t = run.targets[run.targetIndex];
      if (!t) continue;
      const dist = Math.hypot(c.pos[0] - t.pos[0], c.pos[2] - t.pos[2]);
      if (dist < 150) {
        t.done = true;
        t.dist = dist;
        t.score = Math.max(0, Math.round(100 - dist * 1.6));
        run.say(`${t.name}: ${Math.round(dist)} m from the mark  (+${t.score})`, dist < 15 ? '#ffd36b' : '#ffffff', 3);
        run.sounds.push(dist < 15 ? 'ring' : 'thud');
        run.targetIndex++;
        const next = run.targets[run.targetIndex];
        run.waypoint = next ? { pos: next.pos, label: 'DROP' } : null;
      } else {
        run.say(`Crate lost ${Math.round(dist)} m wide`, '#ff8a6b', 2.5);
      }
    }
  }
  const falling = run.crates.some((c) => !c.landed);
  const allDone = run.targetIndex >= run.targets.length;
  if (allDone || (run.cratesLeft === 0 && !falling)) {
    const total = run.targets.reduce((s, t) => s + t.score, 0);
    const avg = total / run.targets.length;
    const medal = avg >= 75 ? 'gold' : avg >= 50 ? 'silver' : avg >= 25 ? 'bronze' : null;
    finish(run, allDone, {
      medal, score: total, headline: allDone ? `All villages supplied: ${total} points` : `Out of crates: ${total} points`,
      lines: run.targets.map((t) => `${t.name}: ${t.done ? `${Math.round(t.dist)} m from the mark  (+${t.score})` : 'no supplies landed'}`),
    });
  }
}

function updateMail(run, ac, world, dt) {
  const id = run.def.stops[run.stopIndex];
  const surf = world.surfaceAt(ac.pos[0], ac.pos[2]);
  if (ac.onGround && length(ac.vel) < 1.5 && surf.strip && surf.strip.id === id) {
    run.holdTimer += dt;
    if (run.holdTimer > 1.5) {
      run.holdTimer = 0;
      run.delivered.push({ name: surf.strip.name, time: run.time });
      run.stopIndex++;
      run.sounds.push('ring');
      if (run.stopIndex >= run.def.stops.length) {
        const medal = timeMedal(run.time, run.def.medals);
        finish(run, true, {
          medal, score: Math.round(600 - run.time), headline: `Mail delivered in ${formatTime(run.time)}`,
          lines: [...run.delivered.map((d) => `${d.name} at ${formatTime(d.time)}`), `Fuel left ${Math.round(ac.fuel)} L, damage ${Math.round(ac.damage)}%`],
        });
      } else {
        const s = findStrip(run.def.stops[run.stopIndex]);
        run.say(`Mailbag delivered: next ${s.name}`, '#ffd36b', 3);
        run.waypoint = { pos: [s.x, s.elev, s.z], label: s.name.toUpperCase() };
      }
    }
  } else run.holdTimer = 0;
}

/** Follow one physics step of the sortie. */
export function updateMission(run, ac, world, dt, actions) {
  if (run.status !== 'running') return;
  run.time += dt;
  if (!run.prevPos) run.prevPos = [...ac.pos];
  if (ac.crashed) {
    finish(run, false, { crash: ac.crashed, medal: null });
    return;
  }
  const k = run.def.kind;
  if (k === 'rings') updateRings(run, ac, run.prevPos);
  else if (k === 'landing') updateLanding(run, ac, world);
  else if (k === 'drop') updateDrop(run, ac, world, dt, actions.drop);
  else if (k === 'mail') updateMail(run, ac, world, dt);
  if (k === 'free' && !run.waypoint) run.waypoint = null;
  run.prevPos = [...ac.pos];
}

/** Lines for the objective panel. */
export function objectiveLines(run, ac) {
  const d = run.def;
  if (d.kind === 'rings') return [`Ring ${Math.min(run.ringIndex + 1, run.rings.length)} of ${run.rings.length}`, `Time ${formatTime(run.time)}`];
  if (d.kind === 'landing') {
    const s = findStrip(d.strip);
    return [run.gate && !run.gate.passed ? 'Fly through the approach gate' : `Land on ${s.name} and stop`, `Wind ${String(Math.round(run.def.wind.fromDeg)).padStart(3, '0')}° at ${Math.round(run.def.wind.speed * 3.6)} km/h`];
  }
  if (d.kind === 'drop') {
    const t = run.targets[run.targetIndex];
    return [t ? `Drop on ${t.name}  [SPACE]` : 'Crates landing...', `Crates ${run.cratesLeft}   Supplied ${run.targetIndex}/${run.targets.length}`];
  }
  if (d.kind === 'mail') {
    const s = findStrip(d.stops[Math.min(run.stopIndex, d.stops.length - 1)]);
    return [`Land and stop at ${s.name}`, `Stop ${run.stopIndex + 1} of ${d.stops.length}   ${formatTime(run.time)}`];
  }
  return ['Explore the isles', ac.refuelling ? 'Refuelling...' : 'Stop on any strip to refuel'];
}

export { RING_RADIUS };
