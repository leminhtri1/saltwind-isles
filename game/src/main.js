// Saltwind Isles: wires the world, renderer, flight model, missions, HUD and audio together and runs
// the title → flight → debrief loop at a fixed physics step. `?shot=<name>` stages a screenshot.
import { attitudeOf, length } from './math3d.js';
import { GLRenderer } from './gl-renderer.js';
import { createWorld } from './world.js';
import { SceneRenderer } from './scene-render.js';
import { AIRFRAME, createAircraft, stepAircraft } from './flight-model.js';
import { Controls } from './controls.js';
import { FlightCamera } from './camera.js';
import { Effects } from './effects.js';
import { FlightAudio } from './audio.js';
import { MISSIONS, formatTime, objectiveLines, startMission, updateMission } from './missions.js';
import { sinkRating } from './landing-score.js';
import { describeCrash } from './crash-report.js';
import { drawInstrumentPanel } from './hud-instruments.js';
import { drawHudOverlay } from './hud-overlay.js';
import { Minimap } from './minimap.js';
import { drawDebrief, drawPause, drawTitle } from './screens.js';
import { findStrip, stripDirection } from './world-layout.js';
import { stageShot } from './shots.js';

const STEP = 1 / 120;
const glCanvas = document.getElementById('view');
const hudCanvas = document.getElementById('hud');
const hud = hudCanvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

const renderer = new GLRenderer(glCanvas);
const world = createWorld();
const scene = new SceneRenderer(renderer, world);
const minimap = new Minimap(world);
const controls = new Controls(hudCanvas);
const camera = new FlightCamera();
const effects = new Effects();
const audio = new FlightAudio();

function loadBest() {
  try { return JSON.parse(localStorage.getItem('saltwind-best') || '{}'); } catch { return {}; }
}

const game = {
  state: 'title', selected: 0, missionIndex: 0, run: null, ac: null, best: shotName ? {} : loadBest(),
  message: null, time: 0, report: null, endTimer: 0, accumulator: 0, titleRows: [], frozen: false,
};

function parkedAircraft() {
  const port = findStrip('port');
  const d = stripDirection(port);
  const pos = [port.x - d[0] * 120 + d[2] * 24, port.elev + 1.35, port.z - d[2] * 120 - d[0] * 24];
  const ac = createAircraft({ pos, heading: (port.heading + 160) * Math.PI / 180, onGround: true, throttle: 0.05 });
  ac.rpm = 800;
  return ac;
}
game.ac = parkedAircraft();

function startMissionAt(index) {
  game.missionIndex = index;
  game.run = startMission(MISSIONS[index], world);
  game.ac = createAircraft(game.run.start);
  effects.clear();
  camera.offset = null;
  game.state = 'flying';
  game.message = null;
  game.report = null;
  game.endTimer = 0;
  game.accumulator = 0;
}

function say(text, color = '#ffffff', seconds = 2.5) {
  game.message = { text, color, left: seconds };
}

function handleEvents(ac, run) {
  for (const e of ac.events) {
    if (e.type === 'touchdown') {
      const r = sinkRating(e.info.vs);
      const strength = Math.min(2, Math.abs(e.info.vs) / 1.5);
      effects.touchdown(ac.pos.map((v, i) => (i === 1 ? v - 1.35 : v)), e.info.kind !== 'runway', strength);
      audio.play('touchdown', Math.min(1.5, 0.4 + strength));
      say(`${r.label} touchdown  ${Math.abs(e.info.vs).toFixed(1)} m/s`, r.points >= 33 ? '#7dffa8' : r.points >= 22 ? '#ffffff' : '#ffb02e', 2.5);
    } else if (e.type === 'crash') {
      effects.crash(ac.pos, e.info.kind === 'water');
      audio.play('crash');
    } else if (e.type === 'damage') say(`Airframe damage ${Math.round(e.amount)}%  (${e.reason})`, '#ff9a3c', 2.5);
    else if (e.type === 'engine-out') { say('ENGINE FAILURE: glide to a strip', '#ff5a3a', 4); audio.play('warn'); }
    else if (e.type === 'fuel-out') { say('Fuel exhausted: engine stopped', '#ff5a3a', 4); audio.play('warn'); }
    else if (e.type === 'tail-strike') say('Tail strike!', '#ff9a3c', 2);
  }
  ac.events.length = 0;
  if (run) {
    for (const m of run.messages) say(m.text, m.color, m.seconds);
    run.messages.length = 0;
    for (const s of run.sounds) {
      audio.play(s);
      if (s === 'ring') {
        const passed = run.gate && run.gate.passed ? run.gate : run.rings[run.ringIndex - 1];
        if (passed) effects.ringBurst(passed.pos);
      }
    }
    run.sounds.length = 0;
  }
}

/** Apply discrete pilot actions, then run fixed physics steps for `dt` seconds. */
function simulate(dt, input, actions = {}) {
  const ac = game.ac, run = game.run;
  if (input.throttleSet !== null && input.throttleSet !== undefined) ac.throttle = input.throttleSet;
  ac.throttle = Math.max(0, Math.min(1, ac.throttle + (input.throttleDelta || 0)));
  ac.brakes = !!input.brakes;
  if (actions.flapsDown) ac.flaps = Math.min(2, ac.flaps + 1);
  if (actions.flapsUp) ac.flaps = Math.max(0, ac.flaps - 1);
  game.accumulator += dt;
  let drop = !!actions.drop;
  while (game.accumulator >= STEP) {
    game.accumulator -= STEP;
    stepAircraft(ac, input, world, STEP);
    if (run) updateMission(run, ac, world, STEP, { drop });
    drop = false;
  }
  // refuel and patch up while stopped on any strip
  const surf = world.surfaceAt(ac.pos[0], ac.pos[2]);
  ac.refuelling = ac.onGround && !ac.crashed && length(ac.vel) < 1.5 && !!surf.strip && (ac.fuel < AIRFRAME.fuelCapacity || ac.damage > 0);
  if (ac.refuelling) {
    ac.fuel = Math.min(AIRFRAME.fuelCapacity, ac.fuel + 9 * dt);
    ac.damage = Math.max(0, ac.damage - 4 * dt);
    if (ac.damage < 100) ac.engineOn = true;
  }
  if (ac.damage > 45 && !ac.crashed) effects.engineSmoke(ac.pos, ac.vel, ac.damage);
  if (run && run.def.kind === 'drop') {
    const t = run.targets[run.targetIndex];
    if (t) effects.flare(t.pos);
  }
  effects.update(dt, world.windAt(ac.pos, ac.time));
  handleEvents(ac, run);
  if (game.message) {
    game.message.left -= dt;
    if (game.message.left <= 0) game.message = null;
  }
}

function finishSortie() {
  const run = game.run;
  if (run.result && run.result.crash) game.report = describeCrash(run.result.crash);
  const m = run.result && run.result.medal;
  if (m && !shotName) {
    const order = { gold: 3, silver: 2, bronze: 1 };
    const prev = game.best[run.def.id];
    if (!prev || order[m] > order[prev]) {
      game.best[run.def.id] = m;
      try { localStorage.setItem('saltwind-best', JSON.stringify(game.best)); } catch { /* private mode */ }
    }
    audio.play('medal');
  }
  game.state = 'debrief';
}

function readouts(ac, run) {
  const att = attitudeOf(ac.q);
  const ground = Math.max(0, world.surfaceAt(ac.pos[0], ac.pos[2]).height);
  ac.headingRad = att.heading;
  let bearing = null;
  if (run && run.waypoint) {
    const p = run.waypoint.pos;
    bearing = Math.atan2(p[0] - ac.pos[0], -(p[2] - ac.pos[2]));
  }
  const agl = Math.max(0, ac.pos[1] - 1.35 - ground);
  return {
    airspeed: ac.airspeed * 3.6, alt: ac.pos[1] - 1.35, agl, vs: ac.vel[1], pitch: att.pitch, bank: att.bank,
    heading: att.heading, bearing, rpm: ac.rpm, fuel: ac.fuel / AIRFRAME.fuelCapacity, fuelLitres: ac.fuel,
    damage: ac.damage / 100, throttle: ac.throttle, flaps: ac.flaps, stall: ac.stallWarning, brakes: ac.brakes,
    engineFail: !ac.engineOn, overspeed: ac.overspeed, groundSpeed: Math.hypot(ac.vel[0], ac.vel[2]) * 3.6,
    pullUp: !ac.onGround && agl < 70 && ac.vel[1] < -9,
  };
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
  renderer.resize(w, h);
  if (hudCanvas.width !== w || hudCanvas.height !== h) {
    hudCanvas.width = w;
    hudCanvas.height = h;
  }
  return { W: w, H: h, dpr };
}

function drawFrame(W, H) {
  const ac = game.ac, run = game.run;
  const cockpit = camera.mode === 'cockpit' && game.state !== 'title' && !(ac && ac.crashed);
  const viewProj = scene.render({ camera, ac, run: game.state === 'title' ? null : run, effects, time: game.time, aspect: W / H, cockpit });
  hud.clearRect(0, 0, W, H);
  const k = H / 800;
  if (game.state === 'title') {
    game.titleRows = drawTitle(hud, W, H, game.selected, game.best, game.time);
    return;
  }
  if (!ac.crashed) {
    const s = readouts(ac, run);
    const panelTop = drawInstrumentPanel(hud, W, H, s, cockpit);
    if (cockpit) drawCockpitFrame(W, H, panelTop);
    const info = {
      title: run ? run.def.title : null,
      lines: run ? objectiveLines(run, ac) : [],
      clock: run && run.def.kind !== 'free' ? formatTime(run.time) : null,
      waypoint: run ? run.waypoint : null,
      bugDeg: s.bearing === null ? null : ((s.bearing * 180 / Math.PI) + 360) % 360,
      message: game.message,
      showFpm: true,
    };
    drawHudOverlay(hud, W, H, s, info, viewProj, ac, panelTop, game.time);
    minimap.draw(hud, W - 105 * k, 100 * k, 84 * k, ac, run);
  } else if (game.message && game.state === 'flying') {
    drawHudOverlay(hud, W, H, readouts(ac, run), { title: run.def.title, lines: [], clock: null, waypoint: null, bugDeg: null, message: game.message }, viewProj, ac, H, game.time);
  }
  if (game.state === 'paused') drawPause(hud, W, H);
  if (game.state === 'debrief') drawDebrief(hud, W, H, run.def, run.result || {}, game.report);
}

function drawCockpitFrame(W, H, panelTop) {
  hud.fillStyle = '#1d1f22';
  hud.beginPath();
  hud.moveTo(0, 0);
  hud.lineTo(W * 0.1, 0);
  hud.lineTo(W * 0.04, panelTop);
  hud.lineTo(0, panelTop);
  hud.fill();
  hud.beginPath();
  hud.moveTo(W, 0);
  hud.lineTo(W * 0.9, 0);
  hud.lineTo(W * 0.96, panelTop);
  hud.lineTo(W, panelTop);
  hud.fill();
  hud.fillRect(0, 0, W, H * 0.035);
  hud.fillStyle = '#2a2d31';
  hud.fillRect(W / 2 - 5, 0, 10, H * 0.12);
}

function updateState(dt) {
  const ac = game.ac;
  if (game.state === 'title') {
    if (controls.consume('ArrowDown') || controls.consume('KeyS')) game.selected = (game.selected + 1) % MISSIONS.length;
    if (controls.consume('ArrowUp') || controls.consume('KeyW')) game.selected = (game.selected + MISSIONS.length - 1) % MISSIONS.length;
    for (let i = 0; i < MISSIONS.length; i++) if (controls.consume('Digit' + (i + 1))) game.selected = i;
    let go = controls.consume('Enter') || controls.consume('Space');
    if (controls.mouse.clicked) {
      audio.start();
      const dpr = hudCanvas.width / window.innerWidth;
      const mx = controls.mouse.x * dpr, my = controls.mouse.y * dpr;
      const row = game.titleRows.find((r) => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
      if (row) { game.selected = row.index; go = true; } else go = true;
    }
    if (go) {
      audio.start();
      startMissionAt(game.selected);
      return;
    }
    simulate(dt, { pitch: 0, roll: 0, yaw: 0, throttleSet: 0.05 });
    camera.orbit(ac.pos, 22, 5, dt, 0.12);
    return;
  }
  if (game.state === 'paused') {
    if (controls.consume('Escape') || controls.consume('KeyP')) game.state = 'flying';
    if (controls.consume('KeyR')) startMissionAt(game.missionIndex);
    if (controls.consume('KeyM')) { game.state = 'title'; game.ac = parkedAircraft(); }
    return;
  }
  if (game.state === 'debrief') {
    simulate(dt, { pitch: 0, roll: 0, yaw: 0 });
    if (ac.crashed) camera.orbit(ac.crashed.pos, 55, 16, dt, 0.12, 14);
    else camera.follow(ac, dt, null, world.terrain.heightAt);
    if (controls.consume('Enter') || controls.consume('KeyR')) startMissionAt(game.missionIndex);
    else if (controls.consume('KeyN')) startMissionAt((game.missionIndex + 1) % MISSIONS.length);
    else if (controls.consume('KeyM') || controls.consume('Escape')) { game.state = 'title'; game.ac = parkedAircraft(); game.run = null; }
    return;
  }
  // flying
  if (controls.consume('Escape') || controls.consume('KeyP')) { game.state = 'paused'; return; }
  if (controls.consume('KeyC')) camera.toggle();
  if (controls.consume('KeyI')) controls.invertPitch = !controls.invertPitch;
  if (controls.consume('KeyM')) audio.muted = !audio.muted;
  if (controls.mouse.clicked) audio.start();
  const input = controls.sample(dt);
  const actions = { flapsDown: controls.consume('KeyF'), flapsUp: controls.consume('KeyR'), drop: controls.consume('Space') };
  if (!ac.crashed) simulate(dt, input, actions);
  else simulate(dt, { pitch: 0, roll: 0, yaw: 0 });
  if (ac.crashed) camera.orbit(ac.crashed.pos, 40, 14, dt, 0.18);
  else camera.follow(ac, dt, input, world.terrain.heightAt);
  if (game.run.status !== 'running') {
    game.endTimer += dt;
    if (game.endTimer > (ac.crashed ? 2.8 : 1.6)) finishSortie();
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.time += dt;
  const { W, H } = resize();
  updateState(dt);
  audio.update(game.ac, game.state === 'flying' || game.state === 'title');
  drawFrame(W, H);
  controls.endFrame();
  requestAnimationFrame(frame);
}

// read-only state for automated play tests
Object.defineProperty(window, '__flight', {
  get: () => ({
    state: game.state, time: game.ac ? game.ac.time : 0, mission: game.run ? game.run.def.id : null, status: game.run ? game.run.status : null,
    pos: game.ac ? [...game.ac.pos] : null, speedKmh: game.ac ? game.ac.airspeed * 3.6 : 0, onGround: game.ac ? game.ac.onGround : null,
    crashed: game.ac && game.ac.crashed ? game.ac.crashed.cause : null, fuel: game.ac ? game.ac.fuel : 0, throttle: game.ac ? game.ac.throttle : 0,
  }),
});

if (shotName) {
  const api = { game, world, camera, effects, startMissionAt, simulate, finishSortie, describeCrash, controls };
  stageShot(shotName, api);
  const { W, H } = resize();
  drawFrame(W, H);
  requestAnimationFrame(() => {
    drawFrame(W, H);
    requestAnimationFrame(() => { window.__shotReady = true; });
  });
} else {
  requestAnimationFrame(frame);
}
