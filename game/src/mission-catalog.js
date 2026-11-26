// The mission catalogue with loadouts, ring-course anchors, briefing routes, and the approach geometry that puts gates on the glide path.
import { DEG } from './math3d.js';
import { VILLAGES, findStrip, stripDirection } from './world-layout.js';

// Each mission: its goal, the wind, the default fuel (litres), and the cargo the pilot may trade against fuel.
export const MISSIONS = [
	{
		id: 'approach', title: 'Harbour Approach', kind: 'landing', strip: 'port', sign: -1, zone: [150, 450], aim: 300, gate: 480,
		wind: { fromDeg: 255, speed: 4, gust: 0.15 }, fuel: 50, goal: 'Land on runway 26, scored out of 100',
		brief: 'Thread the approach gate over the harbour and land on runway 26 at Port Saltwind. Soft, centred, in the zone.',
	},
	{
		id: 'rings', title: 'Gull Rock Gauntlet', kind: 'rings', wind: { fromDeg: 240, speed: 5, gust: 0.2 }, fuel: 60,
		goal: '14 rings against the clock', medals: [150, 185, 1e9],
		brief: 'Rings round Lantern Point and Gull Rock, home over Port Saltwind. Carry less fuel to climb harder, but not too little.',
	},
	{
		id: 'drop', title: 'Lifeline Drop', kind: 'drop', wind: { fromDeg: 230, speed: 6, gust: 0.25 }, fuel: 60,
		cargo: { label: 'CRATES', min: 135, max: 270, step: 45, value: 180, each: 45 }, goal: 'Parachute supplies onto three villages',
		brief: 'Each 45 kg crate is a second chance at a mark, and weight on every climb. Slow down, lead the mark, mind the drift.',
	},
	{
		id: 'shortfield', title: 'Gull Rock Short Field', kind: 'landing', strip: 'gull', sign: 1, zone: [0, 120], aim: 50, gate: 450,
		wind: { fromDeg: 30, speed: 5, gust: 0.2 }, fuel: 40, goal: 'Stop on a 440 m grass strip, +1 per 24 kg of stores',
		cargo: { label: 'MEDICAL STORES', min: 0, max: 240, step: 24, value: 96 },
		brief: 'A windy rock and a short field. More stores score more, but a heavy plane floats long and stops late.',
	},
	{
		id: 'mail', title: 'Island Mail Run', kind: 'mail', stops: ['ember', 'gull', 'port'], fuel: 40,
		cargo: { label: 'FREIGHT', min: 0, max: 200, step: 40, value: 80 }, goal: 'Three strips against the clock, 15 s off per 40 kg',
		wind: { fromDeg: 260, speed: 5, gust: 0.2 }, medals: [300, 420, 1e9],
		brief: 'Mail to Ember Key and Gull Rock, then home. Tank up and fly heavy, or fly light and refuel on a stop while the clock runs.',
	},
	{
		id: 'crosswind', title: 'Saltwind Crosswind', kind: 'landing', strip: 'port', sign: 1, zone: [150, 450], aim: 300, fuel: 50,
		wind: { fromDeg: 160, speed: 9, gust: 0.45 }, goal: 'Land across a 32 km/h gusting wind',
		brief: 'A gusting crosswind across runway 08. Crab in, kick it straight, land on the centreline.',
	},
	{
		id: 'free', title: 'Free Flight', kind: 'free', wind: { fromDeg: 250, speed: 3, gust: 0.15 }, fuel: 120, goal: 'Explore the isles',
		brief: 'No clock, no cargo. Explore from Port Saltwind; stop on any strip to refuel and patch up the plane.',
	},
];

export const RING_ANCHORS = [
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

/** The route a mission flies, as world points [x, z] for the briefing chart, with the marks to draw on it. */
export function routeOf(def) {
	const strip = (id) => { const s = findStrip(id); return [s.x, s.z]; };
	if (def.kind === 'rings') return { path: RING_ANCHORS.map((a) => [a.x, a.z]), marks: 'rings' };
	if (def.kind === 'drop') return { path: [[1500, 250], ...['kelp', 'harbour', 'emberv'].map((id) => { const v = VILLAGES.find((w) => w.id === id); return [v.x, v.z]; })], marks: 'drops' };
	if (def.kind === 'mail') return { path: [strip('port'), ...def.stops.map(strip)], marks: 'strips' };
	if (def.kind === 'landing') {
		const g = approachGeometry(def.strip, def.sign);
		return { path: [[g.threshold[0] - g.dir[0] * 2500, g.threshold[2] - g.dir[2] * 2500], [g.threshold[0], g.threshold[2]]], marks: 'strips' };
	}
	return { path: [strip('port')], marks: 'strips' };
}
