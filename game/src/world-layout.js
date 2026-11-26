// Hand-placed geography: islands, airstrips, villages, harbour, lighthouse, late-morning sun, world size.
import { DEG } from './math3d.js';

export const WORLD_SEED = 7;
export const WORLD_HALF = 4200; // terrain spans -WORLD_HALF..WORLD_HALF metres on X and Z
export const TERRAIN_CELLS = 300;
export const SEA_FLOOR = -20;

const SUN_AZ = 152 * DEG, SUN_EL = 52 * DEG;
export const SUN_DIR = [Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ) * Math.cos(SUN_EL)];

export const ISLAND_BLOBS = [
	['plateau', 150, 320, 1350, 36], ['plateau', -650, -250, 1250, 34], ['plateau', 650, -550, 900, 30], ['peak', -850, -950, 1050, 470],
	['peak', -150, -1350, 650, 210], ['peak', -1500, -200, 600, 150], ['plateau', 2280, -1820, 760, 38], ['peak', 2620, -2250, 520, 190],
	['plateau', -2250, 1950, 880, 36], ['peak', -2700, 2350, 560, 230], ['plateau', 2700, 820, 470, 48], ['peak', 2850, 700, 260, 40],
	['peak', -450, -2750, 420, 95], ['plateau', 1300, 2350, 430, 34], ['peak', -3050, -1150, 560, 160], ['plateau', 3200, -350, 280, 32],
	['peak', 900, 1650, 200, 46],
].map(([kind, x, z, r, h]) => ({ kind, x, z, r, h }));

export const STRIPS = [
	{ id: 'port', name: 'Port Saltwind', x: 150, z: 360, heading: 80, length: 1200, width: 36, elev: 9, surface: 'asphalt' },
	{ id: 'gull', name: 'Gull Rock', x: 2200, z: -1760, heading: 35, length: 440, width: 20, elev: 15, surface: 'grass' },
	{ id: 'ember', name: 'Ember Key', x: -2180, z: 1880, heading: 125, length: 520, width: 20, elev: 12, surface: 'grass' },
];

export const VILLAGES = [
	{ id: 'kelp', name: 'Kelp Bay', x: 380, z: 1080, count: 16, spread: 170 },
	{ id: 'emberv', name: 'Ember Village', x: -2480, z: 1620, count: 13, spread: 150 },
	{ id: 'gullv', name: 'Gull Hamlet', x: 2500, z: -1520, count: 8, spread: 110 },
	{ id: 'harbour', name: 'Saltwind Harbour', x: -900, z: 650, count: 12, spread: 150 },
];

export const LIGHTHOUSE = { name: 'Lantern Point', x: 2860, z: 690 };

export const HARBOUR = { x: -905, z: 655, angle: 2.1, length: 110 };

export const ROADS = [
	[[180, 520], [260, 640], [240, 780], [330, 920], [380, 1060]],
	[[180, 520], [20, 580], [-180, 560], [-400, 640], [-620, 610], [-880, 650]],
];

export function stripDirection(strip) {
	const h = strip.heading * DEG;
	return [Math.sin(h), 0, -Math.cos(h)];
}

export function stripLocal(strip, x, z) {
	const d = stripDirection(strip);
	const dx = x - strip.x, dz = z - strip.z;
	return { along: dx * d[0] + dz * d[2], across: dx * -d[2] + dz * d[0] };
}

export function findStrip(id) {
	return STRIPS.find((s) => s.id === id);
}
