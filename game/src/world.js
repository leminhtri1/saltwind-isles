// The world: terrain, strips, scenery and clouds, plus what surface lies under a point and the wind.
import { DEG, clamp } from './math3d.js';
import { createTerrain } from './terrain.js';
import { buildAirstrips } from './runway.js';
import { buildScenery } from './scenery.js';
import { buildClouds } from './clouds.js';
import { STRIPS, stripLocal } from './world-layout.js';

export function createWorld() {
	const terrain = createTerrain(), wind = { fromDeg: 250, speed: 3, gust: 0.15 };

	function surfaceAt(x, z) {
		for (const s of STRIPS) {
			const { along, across } = stripLocal(s, x, z);
			if (Math.abs(along) <= s.length / 2 + 15 && Math.abs(across) <= s.width / 2 + 3) {
				return { height: s.elev, kind: s.surface === 'asphalt' ? 'runway' : 'strip', strip: s, along, across };
			}
		}
		const h = terrain.heightAt(x, z), flat = terrain.flatnessAt(x, z);
		return h < 0.15 ? { height: 0, kind: 'water' } : { height: h, kind: h < 2.5 ? 'beach' : flat < 0.8 || h > 250 ? 'rock' : 'meadow', flat };
	}

	function windAt(pos, t) {
		const dir = (wind.fromDeg + 180) * DEG, gust = 1 + wind.gust * (Math.sin(t * 0.73 + pos[0] * 0.002) * 0.6 + Math.sin(t * 1.9 + pos[2] * 0.003) * 0.4);
		const v = wind.speed * gust * clamp(0.55 + (pos[1] - Math.max(0, terrain.heightAt(pos[0], pos[2]))) / 200, 0.55, 1);
		return [Math.sin(dir) * v, 0, -Math.cos(dir) * v];
	}

	return { terrain, airstrips: buildAirstrips(terrain.heightAt), scenery: buildScenery(terrain), clouds: buildClouds(), wind, surfaceAt, windAt };
}
