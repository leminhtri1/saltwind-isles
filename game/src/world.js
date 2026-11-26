// The world the aircraft flies in: terrain, airstrips, scenery and clouds built once from the seed,
// plus the questions physics asks of it: what surface lies under a point, and what the wind is doing.
import { DEG, clamp } from './math3d.js';
import { createTerrain } from './terrain.js';
import { buildAirstrips } from './runway.js';
import { buildScenery } from './scenery.js';
import { buildClouds } from './clouds.js';
import { STRIPS, stripLocal } from './world-layout.js';

export function createWorld() {
  const terrain = createTerrain();
  const airstrips = buildAirstrips(terrain.heightAt);
  const scenery = buildScenery(terrain);
  const clouds = buildClouds();
  const wind = { fromDeg: 250, speed: 3, gust: 0.15 };

  /** Ground under (x, z): height, kind (runway, grass strip, meadow, beach, rock, water) and strip. */
  function surfaceAt(x, z) {
    for (const s of STRIPS) {
      const { along, across } = stripLocal(s, x, z);
      if (Math.abs(along) <= s.length / 2 + 15 && Math.abs(across) <= s.width / 2 + 3) {
        return { height: s.elev, kind: s.surface === 'asphalt' ? 'runway' : 'strip', strip: s, along, across };
      }
    }
    const h = terrain.heightAt(x, z);
    if (h < 0.15) return { height: 0, kind: 'water', strip: null };
    const flat = terrain.flatnessAt(x, z);
    const kind = h < 2.5 ? 'beach' : flat < 0.8 || h > 250 ? 'rock' : 'meadow';
    return { height: h, kind, strip: null, flat };
  }

  /** Air-mass velocity at a point (m/s), including gusts that grow near the ground. */
  function windAt(pos, t) {
    const dir = (wind.fromDeg + 180) * DEG;
    const gust = 1 + wind.gust * (Math.sin(t * 0.73 + pos[0] * 0.002) * 0.6 + Math.sin(t * 1.9 + pos[2] * 0.003) * 0.4);
    const agl = pos[1] - Math.max(0, terrain.heightAt(pos[0], pos[2]));
    const shear = clamp(0.55 + agl / 200, 0.55, 1);
    const v = wind.speed * gust * shear;
    return [Math.sin(dir) * v, 0, -Math.cos(dir) * v];
  }

  return { terrain, airstrips, scenery, clouds, wind, surfaceAt, windAt };
}
