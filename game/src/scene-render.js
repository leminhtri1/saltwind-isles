// Draws a frame: sky, islands, sea, strips, scenery, aircraft with moving surfaces and nav lights, mission objects, smoke, glows and clouds.
import { DEG, clamp, length, mat4Compose, mat4FromQuatPos, mat4Identity, mat4LookAt, mat4Perspective, mat4RotateX, mat4RotateY, mat4RotateZ, mat4Scale, mat4Translate, quatRotate, sub } from './math3d.js';
import { SpriteBatch } from './gl-renderer.js';
import { HINGES, NAV_LIGHTS, buildAircraftMeshes } from './aircraft-mesh.js';
import { RING_RADIUS, buildRingMesh } from './rings.js';
import { drawClouds } from './clouds.js';
import { buildChute, buildCrate, buildTargetMarker, buildWindsock } from './prop-meshes.js';
import { SUN_DIR, findStrip, stripDirection } from './world-layout.js';

const about = (model, [x, y, z], rotate) => mat4Compose(model, mat4Translate(x, y, z), rotate, mat4Translate(-x, -y, -z));

export class SceneRenderer {
	constructor(r, world) {
		const up = (m) => r.uploadMesh(m), { airstrips: a, scenery: s } = world, port = findStrip('port'), d = stripDirection(port);
		Object.assign(this, {
			r, world, terrain: up(world.terrain.buildMesh()), water: r.uploadWater(world.terrain.buildWaterGrid(2)), identity: mat4Identity(),
			statics: [[a.base, 1], [a.paint, 2], [s.roads, 1], [a.props], [s.trees], [s.buildings]].map(([m, decal]) => [up(m), decal]),
			ring: up(buildRingMesh()), crate: up(buildCrate()), chute: up(buildChute()), marker: up(buildTargetMarker()), windsock: up(buildWindsock()),
			smoke: new SpriteBatch(), glow: new SpriteBatch(), debris: new SpriteBatch(), puffs: new SpriteBatch(),
			plane: Object.fromEntries(Object.entries(buildAircraftMeshes()).map(([k, v]) => [k, up(v)])),
			sockPos: [port.x - d[0] * 380 + d[2] * 40, port.elev, port.z - d[2] * 380 - d[0] * 40],
		});
	}

	drawAircraft(ac, cockpit, time, right, up) {
		if (cockpit) return;
		const P = this.plane, S = ac.surfaces, model = mat4FromQuatPos(ac.q, ac.pos), tint = ac.crashed ? [0.42, 0.38, 0.36] : [1, 1, 1];
		const { wingTrailing: wt, elevator: el, rudder, prop } = HINGES, a = S.aileron * 0.38, f = ac.flapAngle * 0.62, hinge = (h, ang) => about(model, [0, h.y, h.z], mat4RotateX(ang));
		const parts = [
			[P.body, model], [P.aileronL, hinge(wt, a)], [P.aileronR, hinge(wt, -a)], [P.flapL, hinge(wt, f)], [P.flapR, hinge(wt, f)],
			[P.elevator, hinge(el, -S.elevator * 0.42)], [P.rudder, about(model, [0, 0, rudder.z], mat4RotateY(S.rudder * 0.45))],
		];
		if (ac.parts.gear < 100) parts.push([P.gear, model]);
		for (const [mesh, m] of parts) this.r.drawMesh(mesh, m, { tint });
		if (ac.rpm > 500 && !ac.crashed) this.r.drawMesh(P.disc, model, { alpha: 0.28 });
		else this.r.drawMesh(P.blades, about(model, [0, prop.y, prop.z], mat4RotateZ(ac.propAngle)), { tint });
		if (ac.crashed) return;
		for (const l of NAV_LIGHTS) if (!l.flash || time % 1.2 < 0.12) this.glow.billboard(ac.pos.map((c, i) => c + quatRotate(ac.q, l.p)[i]), l.flash ? 1.1 : 0.5, [...l.c, 0.9], right, up);
		// a soft shadow under the aircraft when it is low
		const g = Math.max(0, this.world.surfaceAt(ac.pos[0], ac.pos[2]).height), agl = ac.pos[1] - g, fw = quatRotate(ac.q, [0, 0, -1]), hf = Math.hypot(fw[0], fw[2]) || 1;
		if (agl > 160) return;
		const fx = fw[0] / hf * 4.2, fz = fw[2] / hf * 4.2, sx = -fz * 1.35, sz = fx * 1.35, p = (u, v) => [ac.pos[0] + fx * u + sx * v, g + 0.25, ac.pos[2] + fz * u + sz * v];
		this.smoke.quad(p(-1, -1), p(-1, 1), p(1, 1), p(1, -1), [0.05, 0.04, 0.06, 0.5 * (1 - agl / 160)]);
	}

	/** Runway, approach (with the sequenced flasher) and PAPI lights, and the lighthouse lamp. */
	addLights(eye, right, up, time) {
		for (const l of this.world.airstrips.lights) {
			const dist = length(sub(l.pos, eye));
			let c = l.color;
			if (l.rabbit === Math.floor((time * 2 % 1) * 11)) this.glow.billboard(l.pos, Math.max(6, dist * 0.016), [0.85, 0.92, 1, 1], right, up);
			if (l.papi) c = Math.atan2(eye[1] - l.pos[1], Math.hypot(eye[0] - l.pos[0], eye[2] - l.pos[2])) / DEG > 2.5 + (4 - l.papi) * 0.33 ? [1, 1, 1] : [1, 0.15, 0.1];
			this.glow.billboard(l.pos, Math.max(l.size, dist * 0.0042), [...c, 0.95], right, up);
		}
		const lamp = this.world.scenery.lighthouseLamp;
		this.glow.billboard(lamp, Math.max(10, length(sub(lamp, eye)) * 0.012), [1, 0.85, 0.5, 0.9], right, up);
	}

	ringGlow(ring, c, right, up, eye) {
		const R = RING_RADIUS, ax = quatRotate(ring.q, [R, 0, 0]), ay = quatRotate(ring.q, [0, R, 0]), s = Math.max(3.2, length(sub(ring.pos, eye)) * 0.006);
		for (let i = 0; i < 20; i++) {
			const co = Math.cos(i * 0.314), si = Math.sin(i * 0.314);
			this.glow.billboard(ring.pos.map((p, k) => p + ax[k] * co + ay[k] * si), s, [...c, 0.55], right, up);
		}
		this.glow.billboard(ring.pos, R * 1.9, [...c, 0.12], right, up);
	}

	/** Render the frame; returns the view-projection matrix used (for HUD projection). */
	render({ camera, ac, run, effects, time, aspect, cockpit }) {
		const r = this.r, view = mat4LookAt(camera.eye, camera.target, camera.up), id = this.identity;
		const proj = mat4Perspective(camera.fov * DEG, aspect, cockpit ? 0.3 : 0.8, 70000);
		const viewProj = r.beginFrame({ view, proj, camPos: camera.eye, sunDir: SUN_DIR, time, fogDensity: 1 / 7000, clouds: this.world.clouds.shadows });
		const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]];
		for (const b of [this.smoke, this.glow, this.debris, this.puffs]) b.clear();
		r.drawSky();
		r.drawMesh(this.terrain, id, { ground: true });
		r.drawWater(this.water);
		for (const [mesh, decal] of this.statics) r.drawMesh(mesh, id, { decal, ground: decal > 0 });
		const wind = this.world.windAt(this.sockPos, time), sag = clamp(1.3 - Math.hypot(wind[0], wind[2]) * 0.12, 0.1, 1.3);
		r.drawMesh(this.windsock, mat4Compose(mat4Translate(...this.sockPos), mat4RotateY(-Math.atan2(wind[0], -wind[2])), about(id, [0, 7.8, 0], mat4RotateX(-sag))));
		if (run) {
			for (const t of run.targets) {
				if (t.done) continue;
				r.drawMesh(this.marker, mat4Translate(t.pos[0], t.pos[1] + 0.05, t.pos[2]), { decal: 3 });
				// the smoke flare's glowing column over the mark
				const b0 = t.pos.map((p, k) => p - right[k] * 3), b1 = t.pos.map((p, k) => p + right[k] * 3);
				this.glow.quad(b0, b1, [b1[0], b1[1] + 160, b1[2]], [b0[0], b0[1] + 160, b0[2]], [1, 0.5, 0.2, 0.35]);
			}
			for (const c of run.crates) {
				r.drawMesh(this.crate, mat4Translate(...c.pos));
				if (c.chute > 0 && !c.landed) r.drawMesh(this.chute, mat4Compose(mat4Translate(...c.pos), mat4Scale(c.chute, c.chute, c.chute)));
			}
			// the next ring glows amber, the three after it blue
			(run.gate ? [run.gate] : run.rings).filter((g) => !g.passed).slice(0, 4).forEach((ring, i) => {
				r.drawMesh(this.ring, ring.model, { tint: i ? [0.4, 0.85, 1] : [1, 0.72, 0.22] });
				this.ringGlow(ring, i ? [0.3, 0.75, 1] : [1, 0.62, 0.15], right, up, camera.eye);
			});
		}
		if (ac) this.drawAircraft(ac, cockpit, time, right, up);
		this.addLights(camera.eye, right, up, time);
		if (effects) effects.draw(this.smoke, this.glow, this.debris, right, up);
		r.drawSprites(this.debris, { softness: 0.2, fogged: true });
		r.drawSprites(this.smoke, { softness: 1.2, fogged: true });
		r.drawSprites(this.glow, { additive: true, softness: 2.2 });
		drawClouds(this.puffs, this.world.clouds.puffs, camera.eye, right, up);
		r.drawSprites(this.puffs, { cloud: true });
		return viewProj;
	}
}
