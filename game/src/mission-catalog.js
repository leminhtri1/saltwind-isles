// The mission catalogue with loadouts, ring-course anchors, briefing routes, and the approach geometry that puts gates on the glide path.
import { DEG } from './math3d.js';
import { VILLAGES, findStrip, stripDirection } from './world-layout.js';

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
	[1300, 180, 70], [2000, 420, 60], [2600, 460, 75], [3050, -120, 60], [2950, -900, 70], [2450, -1300, 60], [1850, -2050, 70],
	[2250, -2700, 85], [3000, -2550, 70], [3150, -1750, 60], [1350, -1500, 70], [450, -950, 90], [-150, -350, 80], [350, 330, 45],
].map(([x, z, agl]) => ({ x, z, agl }));

export function approachGeometry(stripId, sign) {
	const s = findStrip(stripId), d = stripDirection(s).map((v) => v * sign);
	return { strip: s, dir: d, threshold: [s.x - d[0] * s.length / 2, s.elev, s.z - d[2] * s.length / 2], heading: (s.heading + (sign < 0 ? 180 : 0)) % 360 };
}

export function glidePathPoint(geo, dist, aim) {
	const h = geo.strip.elev + (dist + aim) * Math.tan(3.2 * DEG) + 2;
	return [geo.threshold[0] - geo.dir[0] * dist, h, geo.threshold[2] - geo.dir[2] * dist];
}

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
