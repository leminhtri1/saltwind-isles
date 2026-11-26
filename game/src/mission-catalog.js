// The mission catalogue, ring-course anchors and the approach geometry that puts gates on the glide path.
import { DEG } from './math3d.js';
import { findStrip, stripDirection } from './world-layout.js';

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
