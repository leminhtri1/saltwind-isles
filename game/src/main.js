// Saltwind Isles entry point: title, flight and debrief loop at a fixed physics step; ?shot=<name> stages a screenshot.
import { attitudeOf, length } from './math3d.js';
import { GLRenderer } from './gl-renderer.js';
import { createWorld } from './world.js';
import { SceneRenderer } from './scene-render.js';
import { AIRFRAME, createAircraft, stepAircraft } from './flight-model.js';
import { Controls } from './controls.js';
import { FlightCamera } from './camera.js';
import { Effects } from './effects.js';
import { FlightAudio } from './audio.js';
import { MISSIONS, dropAimText, formatTime, objectiveLines, predictCrateLanding, startMission, updateMission } from './missions.js';
import { sinkRating } from './landing-score.js';
import { describeCrash } from './crash-report.js';
import { drawInstrumentPanel } from './hud-instruments.js';
import { drawHudOverlay } from './hud-overlay.js';
import { Minimap } from './minimap.js';
import { drawDebrief, drawPause, drawTitle } from './screens.js';
import { findStrip, stripDirection } from './world-layout.js';
import { stageShot } from './shots.js';

const STEP = 1 / 120;
const IDLE = { pitch: 0, roll: 0, yaw: 0 };
const hudCanvas = document.getElementById('hud');
const hud = hudCanvas.getContext('2d');
const shotName = new URLSearchParams(location.search).get('shot');
const renderer = new GLRenderer(document.getElementById('view'));
const world = createWorld();
const scene = new SceneRenderer(renderer, world);
const minimap = new Minimap(world);
const controls = new Controls(hudCanvas);
const camera = new FlightCamera();
const effects = new Effects();
const audio = new FlightAudio();

const loadBest = () => { try { return JSON.parse(localStorage.getItem('saltwind-best') || '{}'); } catch { return {}; } };
const game = { state: 'title', selected: 0, missionIndex: 0, run: null, ac: null, best: shotName ? {} : loadBest(), message: null, time: 0, report: null, endTimer: 0, accumulator: 0, titleRows: [] };

/** The Kittiwake parked beside Port Saltwind's runway, idling behind the title screen. */
function parkedAircraft() {
	const port = findStrip('port'), d = stripDirection(port);
	const ac = createAircraft({ pos: [port.x - d[0] * 120 + d[2] * 24, port.elev + 1.35, port.z - d[2] * 120 - d[0] * 24], heading: (port.heading + 160) * Math.PI / 180, onGround: true, throttle: 0.05 });
	ac.rpm = 800;
	return ac;
}
game.ac = parkedAircraft();

function toTitle() {
	Object.assign(game, { state: 'title', ac: parkedAircraft(), run: null });
}

function startMissionAt(index) {
	const run = startMission(MISSIONS[index], world);
	Object.assign(game, { missionIndex: index, run, ac: createAircraft(run.start), state: 'flying', message: null, report: null, endTimer: 0, accumulator: 0 });
	effects.clear();
	camera.offset = null;
}

function say(text, color = '#ffffff', seconds = 2.5) {
	game.message = { text, color, left: seconds };
}

/** Turn flight-model and mission events into effects, sounds and messages. */
function handleEvents(ac, run) {
	for (const e of ac.events) {
		if (e.type === 'touchdown') {
			const r = sinkRating(e.info.vs), strength = Math.min(2, Math.abs(e.info.vs) / 1.5);
			effects.touchdown([ac.pos[0], ac.pos[1] - 1.35, ac.pos[2]], e.info.kind !== 'runway', strength);
			audio.play('touchdown', Math.min(1.5, 0.4 + strength));
			say(`${r.label} touchdown  ${Math.abs(e.info.vs).toFixed(1)} m/s`, r.points >= 33 ? '#7dffa8' : r.points >= 22 ? '#ffffff' : '#ffb02e');
		} else if (e.type === 'crash') {
			effects.crash(ac.pos, e.info.kind === 'water');
			audio.play('crash');
		} else if (e.type === 'damage') say(`Airframe damage ${Math.round(e.amount)}%  (${e.reason})`, '#ff9a3c');
		else if (e.type === 'engine-out' || e.type === 'fuel-out') {
			say(e.type === 'fuel-out' ? 'Fuel exhausted: engine stopped' : 'ENGINE FAILURE: glide to a strip', '#ff5a3a', 4);
			audio.play('warn');
		} else if (e.type === 'tail-strike') say('Tail strike!', '#ff9a3c', 2);
	}
	ac.events.length = 0;
	if (!run) return;
	for (const m of run.messages) say(m.text, m.color, m.seconds);
	for (const s of run.sounds) {
		audio.play(s);
		const passed = s === 'ring' && (run.gate && run.gate.passed ? run.gate : run.rings[run.ringIndex - 1]);
		if (passed) effects.ringBurst(passed.pos);
	}
	run.messages.length = run.sounds.length = 0;
}

/** Apply the pilot's settings, run fixed physics steps for `dt` seconds, refuel when stopped on a strip. */
function simulate(dt, input, actions = {}) {
	const ac = game.ac, run = game.run;
	if (input.throttleSet != null) ac.throttle = input.throttleSet;
	ac.throttle = Math.max(0, Math.min(1, ac.throttle + (input.throttleDelta || 0)));
	ac.brakes = !!input.brakes;
	ac.flaps = Math.max(0, Math.min(2, ac.flaps + (actions.flapsDown ? 1 : 0) - (actions.flapsUp ? 1 : 0)));
	let drop = !!actions.drop;
	for (game.accumulator += dt; game.accumulator >= STEP; game.accumulator -= STEP, drop = false) {
		stepAircraft(ac, input, world, STEP);
		if (run) updateMission(run, ac, world, STEP, { drop });
	}
	const surf = world.surfaceAt(ac.pos[0], ac.pos[2]);
	ac.refuelling = ac.onGround && !ac.crashed && length(ac.vel) < 1.5 && !!surf.strip && (ac.fuel < AIRFRAME.fuelCapacity || ac.damage > 0);
	if (ac.refuelling) {
		ac.fuel = Math.min(AIRFRAME.fuelCapacity, ac.fuel + 9 * dt);
		ac.damage = Math.max(0, ac.damage - 4 * dt);
		ac.engineOn = ac.damage < 100;
	}
	if (ac.damage > 45 && !ac.crashed) effects.engineSmoke(ac.pos, ac.vel, ac.damage);
	const target = run && run.targets[run.targetIndex];
	if (target) effects.flare(target.pos);
	effects.update(dt, world.windAt(ac.pos, ac.time));
	handleEvents(ac, run);
	if (game.message && (game.message.left -= dt) <= 0) game.message = null;
}

function finishSortie() {
	const run = game.run, m = run.result && run.result.medal;
	if (run.result && run.result.crash) game.report = describeCrash(run.result.crash);
	if (m && !shotName) {
		const order = { gold: 3, silver: 2, bronze: 1 }, prev = game.best[run.def.id];
		if (!prev || order[m] > order[prev]) {
			game.best[run.def.id] = m;
			try { localStorage.setItem('saltwind-best', JSON.stringify(game.best)); } catch { /* private mode */ }
		}
		audio.play('medal');
	}
	game.state = 'debrief';
}

/** Everything the instruments and head-up layer display. */
function readouts(ac, run) {
	const att = attitudeOf(ac.q), wp = run && run.waypoint;
	const agl = Math.max(0, ac.pos[1] - 1.35 - Math.max(0, world.surfaceAt(ac.pos[0], ac.pos[2]).height));
	ac.headingRad = att.heading;
	return {
		airspeed: ac.airspeed * 3.6, alt: ac.pos[1] - 1.35, agl, vs: ac.vel[1], pitch: att.pitch, bank: att.bank, heading: att.heading,
		bearing: wp ? Math.atan2(wp.pos[0] - ac.pos[0], -(wp.pos[2] - ac.pos[2])) : null, rpm: ac.rpm,
		fuel: ac.fuel / AIRFRAME.fuelCapacity, fuelLitres: ac.fuel, damage: ac.damage / 100, throttle: ac.throttle, flaps: ac.flaps,
		stall: ac.stallWarning, brakes: ac.brakes, engineFail: !ac.engineOn, overspeed: ac.overspeed,
		groundSpeed: Math.hypot(ac.vel[0], ac.vel[2]) * 3.6, pullUp: !ac.onGround && agl < 70 && ac.vel[1] < -9,
	};
}

function resize() {
	const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
	const W = Math.round(window.innerWidth * dpr), H = Math.round(window.innerHeight * dpr);
	renderer.resize(W, H);
	if (hudCanvas.width !== W || hudCanvas.height !== H) Object.assign(hudCanvas, { width: W, height: H });
	return { W, H };
}

function drawFrame(W, H) {
	const { ac, run, state } = game;
	const cockpit = camera.mode === 'cockpit' && state !== 'title' && !ac.crashed;
	const viewProj = scene.render({ camera, ac, run: state === 'title' ? null : run, effects, time: game.time, aspect: W / H, cockpit });
	hud.clearRect(0, 0, W, H);
	if (state === 'title') {
		game.titleRows = drawTitle(hud, W, H, game.selected, game.best, game.time);
		return;
	}
	const s = readouts(ac, run), k = H / 800;
	const info = { title: run.def.title, lines: [], clock: null, waypoint: null, bugDeg: null, message: game.message };
	if (!ac.crashed) {
		const panelTop = drawInstrumentPanel(hud, W, H, s, cockpit);
		Object.assign(info, {
			lines: objectiveLines(run, ac), clock: run.def.kind !== 'free' ? formatTime(run.time) : null, waypoint: run.waypoint,
			bugDeg: s.bearing === null ? null : ((s.bearing * 180) / Math.PI + 360) % 360,
			dropAim: run.def.kind === 'drop' && !ac.onGround && run.cratesLeft > 0 ? predictCrateLanding(ac, world, run.time) : null,
		});
		if (info.dropAim) info.lines.push(dropAimText(run, info.dropAim, s.heading));
		drawHudOverlay(hud, W, H, s, info, viewProj, ac, panelTop, game.time);
		minimap.draw(hud, W - 105 * k, 100 * k, 84 * k, ac, run);
	} else if (game.message && state === 'flying') drawHudOverlay(hud, W, H, s, info, viewProj, ac, H, game.time);
	if (state === 'paused') drawPause(hud, W, H);
	if (state === 'debrief') drawDebrief(hud, W, H, run.def, run.result || {}, game.report);
}

function updateTitle(dt) {
	const n = MISSIONS.length;
	if (controls.consume('ArrowDown') || controls.consume('KeyS')) game.selected = (game.selected + 1) % n;
	if (controls.consume('ArrowUp') || controls.consume('KeyW')) game.selected = (game.selected + n - 1) % n;
	for (let i = 0; i < n; i++) if (controls.consume('Digit' + (i + 1))) game.selected = i;
	let go = controls.consume('Enter') || controls.consume('Space');
	if (controls.mouse.clicked) {
		const dpr = hudCanvas.width / window.innerWidth, mx = controls.mouse.x * dpr, my = controls.mouse.y * dpr;
		const row = game.titleRows.find((r) => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
		if (row) game.selected = row.index;
		go = true;
	}
	if (go) {
		audio.start();
		startMissionAt(game.selected);
		return;
	}
	simulate(dt, { ...IDLE, throttleSet: 0.05 });
	camera.orbit(game.ac.pos, 24, 3, dt, 0.1, -1.8, 10);
}

function updateState(dt) {
	const { ac, state } = game;
	if (state === 'title') return updateTitle(dt);
	if (state === 'paused') {
		if (controls.consume('Escape') || controls.consume('KeyP')) game.state = 'flying';
		if (controls.consume('KeyR')) startMissionAt(game.missionIndex);
		if (controls.consume('KeyM')) toTitle();
		return;
	}
	if (state === 'debrief') {
		simulate(dt, IDLE);
		if (ac.crashed) camera.orbit(ac.crashed.pos, 55, 16, dt, 0.12, 14);
		else camera.follow(ac, dt, null, world.terrain.heightAt);
		if (controls.consume('Enter') || controls.consume('KeyR')) startMissionAt(game.missionIndex);
		else if (controls.consume('KeyN')) startMissionAt((game.missionIndex + 1) % MISSIONS.length);
		else if (controls.consume('KeyM') || controls.consume('Escape')) toTitle();
		return;
	}
	if (controls.consume('Escape') || controls.consume('KeyP')) return void (game.state = 'paused');
	if (controls.consume('KeyC')) camera.toggle();
	if (controls.consume('KeyI')) controls.invertPitch = !controls.invertPitch;
	if (controls.consume('KeyM')) audio.muted = !audio.muted;
	if (controls.mouse.clicked) audio.start();
	const input = ac.crashed ? IDLE : controls.sample(dt);
	simulate(dt, input, { flapsDown: controls.consume('KeyF'), flapsUp: controls.consume('KeyR'), drop: controls.consume('Space') });
	if (ac.crashed) camera.orbit(ac.crashed.pos, 40, 14, dt, 0.18);
	else camera.follow(ac, dt, input, world.terrain.heightAt);
	if (game.run.status !== 'running' && (game.endTimer += dt) > (ac.crashed ? 2.8 : 1.6)) finishSortie();
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
	get: () => {
		const { ac, run } = game;
		return {
			state: game.state, time: ac.time, mission: run ? run.def.id : null, status: run ? run.status : null, pos: [...ac.pos],
			speedKmh: ac.airspeed * 3.6, onGround: ac.onGround, crashed: ac.crashed ? ac.crashed.cause : null, fuel: ac.fuel, throttle: ac.throttle,
		};
	},
});

if (shotName) {
	stageShot(shotName, { game, world, camera, effects, startMissionAt, simulate, finishSortie });
	const { W, H } = resize();
	drawFrame(W, H);
	requestAnimationFrame(() => {
		drawFrame(W, H);
		requestAnimationFrame(() => { window.__shotReady = true; });
	});
} else requestAnimationFrame(frame);
