// Draws a frame: sky, islands, sea, strips, scenery, clouds, aircraft, mission objects, smoke and glows.
import {
	DEG, clamp, length, mat4Compose, mat4FromQuatPos, mat4Identity, mat4LookAt, mat4Perspective, mat4RotateX, mat4RotateY,
	mat4RotateZ, mat4Scale, mat4Translate, quatRotate, sub,
} from './math3d.js';
import { SpriteBatch } from './gl-renderer.js';
import { HINGES, NAV_LIGHTS, buildAircraftMeshes } from './aircraft-mesh.js';
import { RING_RADIUS, buildRingMesh } from './rings.js';
import { drawClouds } from './clouds.js';
import { buildChute, buildCrate, buildTargetMarker, buildWindsock } from './prop-meshes.js';
import { SUN_DIR, findStrip, stripDirection } from './world-layout.js';

function hingeX(model, y, z, angle) {
	return mat4Compose(model, mat4Translate(0, y, z), mat4RotateX(angle), mat4Translate(0, -y, -z));
}

export class SceneRenderer {
	constructor(renderer, world) {
		const up = (m) => renderer.uploadMesh(m), { airstrips: a, scenery } = world;
		Object.assign(this, {
			r: renderer, world, terrain: up(world.terrain.buildMesh()), water: renderer.uploadWater(world.terrain.buildWaterGrid(2)),
			stripBase: up(a.base), stripPaint: up(a.paint), stripProps: up(a.props), trees: up(scenery.trees), buildings: up(scenery.buildings), roads: up(scenery.roads),
			cloudPuffs: new SpriteBatch(), ring: up(buildRingMesh()), crate: up(buildCrate()), chute: up(buildChute()), marker: up(buildTargetMarker()),
			windsock: up(buildWindsock()), smoke: new SpriteBatch(), glow: new SpriteBatch(), debris: new SpriteBatch(), identity: mat4Identity(),
		});
		this.plane = Object.fromEntries(Object.entries(buildAircraftMeshes()).map(([k, v]) => [k, up(v)]));
		const port = findStrip('port'), d = stripDirection(port);
		this.sockPos = [port.x - d[0] * 380 + d[2] * 40, port.elev, port.z - d[2] * 380 - d[0] * 40];
	}

	navLights(ac, time, right, up) {
		for (const l of NAV_LIGHTS) {
			const on = !l.flash || time % 1.2 < 0.12, p = quatRotate(ac.q, l.p);
			if (on) this.glow.billboard([ac.pos[0] + p[0], ac.pos[1] + p[1], ac.pos[2] + p[2]], l.flash ? 1.1 : 0.5, [...l.c, 0.9], right, up);
		}
	}

	drawAircraft(ac, cockpit) {
		const r = this.r, P = this.plane;
		const model = mat4FromQuatPos(ac.q, ac.pos);
		const tint = ac.crashed ? [0.42, 0.38, 0.36] : [1, 1, 1];
		if (!cockpit) {
			const { wingTrailing: wt, elevator: el, rudder: { z: rz } } = HINGES, a = ac.surfaces.aileron * 0.38, f = ac.flapAngle * 0.62;
			const parts = [
				[P.body, model], [P.aileronL, hingeX(model, wt.y, wt.z, a)], [P.aileronR, hingeX(model, wt.y, wt.z, -a)],
				[P.flapL, hingeX(model, wt.y, wt.z, f)], [P.flapR, hingeX(model, wt.y, wt.z, f)],
				[P.elevator, hingeX(model, el.y, el.z, -ac.surfaces.elevator * 0.42)],
				[P.rudder, mat4Compose(model, mat4Translate(0, 0, rz), mat4RotateY(ac.surfaces.rudder * 0.45), mat4Translate(0, 0, -rz))],
			];
			for (const [mesh, m] of parts) r.drawMesh(mesh, m, { tint });
		}
		const py = HINGES.prop.y, pz = HINGES.prop.z;
		const spin = mat4Compose(model, mat4Translate(0, py, pz), mat4RotateZ(ac.propAngle), mat4Translate(0, -py, -pz));
		if (ac.rpm > 500 && !ac.crashed) {
			if (!cockpit) r.drawMesh(P.disc, model, { alpha: 0.28 });
		} else if (!cockpit) r.drawMesh(P.blades, spin, { tint });
	}

	addLights(eye, right, up) {
		for (const l of this.world.airstrips.lights) {
			const dist = length(sub(l.pos, eye));
			let color = l.color;
			if (l.papi) {
				const h = Math.hypot(eye[0] - l.pos[0], eye[2] - l.pos[2]);
				const angle = Math.atan2(eye[1] - l.pos[1], h) / DEG;
				color = angle > 2.5 + (3 - l.papi.index) * 0.33 ? [1, 1, 1] : [1, 0.15, 0.1];
			}
			const size = Math.max(l.size, dist * 0.0042);
			this.glow.billboard(l.pos, size, [color[0], color[1], color[2], 0.95], right, up);
		}
		const lamp = this.world.scenery.lighthouseLamp;
		const ld = length(sub(lamp, eye));
		this.glow.billboard(lamp, Math.max(10, ld * 0.012), [1, 0.85, 0.5, 0.9], right, up);
	}

	ringGlow(ring, color, right, up, eye) {
		const R = RING_RADIUS;
		const ax = quatRotate(ring.q, [1, 0, 0]), ay = quatRotate(ring.q, [0, 1, 0]);
		const dist = length(sub(ring.pos, eye));
		const s = Math.max(3.2, dist * 0.006);
		for (let i = 0; i < 20; i++) {
			const a = (i / 20) * Math.PI * 2;
			const p = [ring.pos[0] + (ax[0] * Math.cos(a) + ay[0] * Math.sin(a)) * R, ring.pos[1] + (ax[1] * Math.cos(a) + ay[1] * Math.sin(a)) * R, ring.pos[2] + (ax[2] * Math.cos(a) + ay[2] * Math.sin(a)) * R];
			this.glow.billboard(p, s, [color[0], color[1], color[2], 0.55], right, up);
		}
		this.glow.billboard(ring.pos, R * 1.9, [color[0], color[1], color[2], 0.12], right, up);
	}

	/** Render the frame; returns the view-projection matrix used (for HUD projection). */
	render({ camera, ac, run, effects, time, aspect, cockpit }) {
		const r = this.r;
		const view = mat4LookAt(camera.eye, camera.target, camera.up);
		const proj = mat4Perspective(camera.fov * DEG, aspect, cockpit ? 0.3 : 0.8, 70000);
		const viewProj = r.beginFrame({ view, proj, camPos: camera.eye, sunDir: SUN_DIR, time, fogDensity: 1 / 7000, clouds: this.world.clouds.shadows });
		const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]];
		for (const b of [this.smoke, this.glow, this.debris]) b.clear();

		r.drawSky();
		r.drawMesh(this.terrain, this.identity, { ground: true });
		r.drawWater(this.water);
		for (const [mesh, decal] of [[this.stripBase, 1], [this.stripPaint, 2], [this.roads, 1], [this.stripProps], [this.trees], [this.buildings]]) r.drawMesh(mesh, this.identity, { decal, ground: decal > 0 });
		const wind = this.world.windAt(this.sockPos, time);
		const wspeed = Math.hypot(wind[0], wind[2]);
		const sockHeading = Math.atan2(wind[0], -wind[2]);
		r.drawMesh(this.windsock, mat4Compose(mat4Translate(...this.sockPos), mat4RotateY(-sockHeading), mat4Translate(0, 7.8, 0), mat4RotateX(-clamp(1.3 - wspeed * 0.12, 0.1, 1.3)), mat4Translate(0, -7.8, 0)));

		if (run) {
			for (const t of run.targets) {
				if (t.done) continue;
				r.drawMesh(this.marker, mat4Translate(t.pos[0], t.pos[1] + 0.05, t.pos[2]), { decal: 3 });
			}
			for (const c of run.crates) {
				r.drawMesh(this.crate, mat4Translate(c.pos[0], c.pos[1], c.pos[2]));
				if (c.chute > 0 && !c.landed) r.drawMesh(this.chute, mat4Compose(mat4Translate(c.pos[0], c.pos[1], c.pos[2]), mat4Scale(c.chute, c.chute, c.chute)));
			}
			const rings = run.gate ? [run.gate] : run.rings;
			let shown = 0;
			for (let i = 0; i < rings.length && shown < 4; i++) {
				const ring = rings[i];
				if (ring.passed) continue;
				const next = shown === 0;
				const color = next ? [1, 0.72, 0.22] : [0.4, 0.85, 1];
				r.drawMesh(this.ring, ring.model, { tint: color });
				this.ringGlow(ring, next ? [1, 0.62, 0.15] : [0.3, 0.75, 1], right, up, camera.eye);
				shown++;
			}
		}

		if (ac) {
			this.drawAircraft(ac, cockpit);
			if (!cockpit && !ac.crashed) this.navLights(ac, time, right, up);
			if (!cockpit && !ac.crashed) {
				const g = Math.max(0, this.world.surfaceAt(ac.pos[0], ac.pos[2]).height);
				const agl = ac.pos[1] - g;
				if (agl < 160) {
					const f = quatRotate(ac.q, [0, 0, -1]);
					const hf = Math.hypot(f[0], f[2]) || 1;
					const fx = f[0] / hf * 4.2, fz = f[2] / hf * 4.2, sx = -fz * 1.35, sz = fx * 1.35;
					const y = g + 0.25, a = 0.5 * (1 - agl / 160);
					this.smoke.quad([ac.pos[0] - fx - sx, y, ac.pos[2] - fz - sz], [ac.pos[0] - fx + sx, y, ac.pos[2] - fz + sz], [ac.pos[0] + fx + sx, y, ac.pos[2] + fz + sz], [ac.pos[0] + fx - sx, y, ac.pos[2] + fz - sz], [0.05, 0.04, 0.06, a]);
				}
			}
		}
		if (run) {
			for (const t of run.targets) {
				if (t.done) continue;
				const b0 = [t.pos[0] - right[0] * 3, t.pos[1], t.pos[2] - right[2] * 3], b1 = [t.pos[0] + right[0] * 3, t.pos[1], t.pos[2] + right[2] * 3];
				this.glow.quad(b0, b1, [b1[0], b1[1] + 160, b1[2]], [b0[0], b0[1] + 160, b0[2]], [1, 0.5, 0.2, 0.35]);
			}
		}
		this.addLights(camera.eye, right, up);
		if (effects) effects.draw(this.smoke, this.glow, this.debris, right, up);
		r.drawSprites(this.debris, { softness: 0.2, fogged: true });
		r.drawSprites(this.smoke, { softness: 1.2, fogged: true });
		r.drawSprites(this.glow, { additive: true, softness: 2.2 });
		this.cloudPuffs.clear();
		drawClouds(this.cloudPuffs, this.world.clouds.puffs, camera.eye, right, up);
		r.drawSprites(this.cloudPuffs, { cloud: true });
		return viewProj;
	}
}

