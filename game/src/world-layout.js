// Hand-placed geography: islands, airstrips, villages, lighthouse, golden-hour sun, world size.
import { DEG } from './math3d.js';

export const WORLD_SEED = 7;
export const WORLD_HALF = 4200; // terrain spans -WORLD_HALF..WORLD_HALF metres on X and Z
export const TERRAIN_CELLS = 210;
export const SEA_FLOOR = -20;

// Low golden-hour sun from the south-east, warm light and long shadows.
const SUN_AZ = 128 * DEG, SUN_EL = 13 * DEG;
export const SUN_DIR = [Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ) * Math.cos(SUN_EL)];

/** Island building blocks: broad plateaus carry the strips and villages, peaks raise the hills. */
export const ISLAND_BLOBS = [
  // Saltwind, the main island
  { kind: 'plateau', x: 150, z: 320, r: 1350, h: 36 },
  { kind: 'plateau', x: -650, z: -250, r: 1250, h: 34 },
  { kind: 'plateau', x: 650, z: -550, r: 900, h: 30 },
  { kind: 'peak', x: -850, z: -950, r: 1050, h: 470 },
  { kind: 'peak', x: -150, z: -1350, r: 650, h: 210 },
  { kind: 'peak', x: -1500, z: -200, r: 600, h: 150 },
  // Gull Rock, north-east
  { kind: 'plateau', x: 2280, z: -1820, r: 760, h: 38 },
  { kind: 'peak', x: 2620, z: -2250, r: 520, h: 190 },
  // Ember Key, south-west
  { kind: 'plateau', x: -2250, z: 1950, r: 880, h: 36 },
  { kind: 'peak', x: -2700, z: 2350, r: 560, h: 230 },
  // Lantern Point, east
  { kind: 'plateau', x: 2700, z: 820, r: 470, h: 48 },
  { kind: 'peak', x: 2850, z: 700, r: 260, h: 40 },
  // islets
  { kind: 'peak', x: -450, z: -2750, r: 420, h: 95 },
  { kind: 'plateau', x: 1300, z: 2350, r: 430, h: 34 },
  { kind: 'peak', x: -3050, z: -1150, r: 560, h: 160 },
  { kind: 'plateau', x: 3200, z: -350, r: 280, h: 32 },
  { kind: 'peak', x: 900, z: 1650, r: 200, h: 46 },
];

/**
 * Airstrips. `heading` is the landing direction of the first runway end (degrees clockwise from
 * north); the strip runs along it, centred on (x, z), and is flattened to `elev` metres.
 */
export const STRIPS = [
  { id: 'port', name: 'Port Saltwind', x: 150, z: 360, heading: 80, length: 1200, width: 36, elev: 9, surface: 'asphalt', lights: true },
  { id: 'gull', name: 'Gull Rock', x: 2200, z: -1760, heading: 35, length: 440, width: 20, elev: 15, surface: 'grass', lights: false },
  { id: 'ember', name: 'Ember Key', x: -2180, z: 1880, heading: 125, length: 520, width: 20, elev: 12, surface: 'grass', lights: false },
];

export const VILLAGES = [
  { id: 'kelp', name: 'Kelp Bay', x: 380, z: 1080, count: 16, spread: 170 },
  { id: 'emberv', name: 'Ember Village', x: -2480, z: 1620, count: 13, spread: 150 },
  { id: 'gullv', name: 'Gull Hamlet', x: 2500, z: -1520, count: 8, spread: 110 },
  { id: 'harbour', name: 'Saltwind Harbour', x: -900, z: 650, count: 12, spread: 150 },
];

export const LIGHTHOUSE = { name: 'Lantern Point', x: 2860, z: 690 };

/** Unit vector along a strip's landing heading. */
export function stripDirection(strip) {
  const h = strip.heading * DEG;
  return [Math.sin(h), 0, -Math.cos(h)];
}

/** Runway designator pair, e.g. "08 / 26". */
export function stripDesignators(strip) {
  const a = Math.round(strip.heading / 10) % 36 || 36;
  const b = (a + 18) % 36 || 36;
  return [String(a).padStart(2, '0'), String(b).padStart(2, '0')];
}

/** Position along (metres from centre, + toward landing direction) and across (+ right) a strip. */
export function stripLocal(strip, x, z) {
  const d = stripDirection(strip);
  const dx = x - strip.x, dz = z - strip.z;
  return { along: dx * d[0] + dz * d[2], across: dx * -d[2] + dz * d[0] };
}

export function findStrip(id) {
  return STRIPS.find((s) => s.id === id);
}
