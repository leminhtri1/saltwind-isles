// Draws one frame of the 3D world in order: sky, islands, sea, airstrips, trees, villages, clouds,
// the aircraft with its moving control surfaces and propeller, mission rings, crates and markers,
// then smoke and the additive glows of runway lights, rings and fire.
import {
  DEG, clamp, length, mat4Compose, mat4FromQuatPos, mat4Identity, mat4LookAt, mat4Perspective, mat4RotateX, mat4RotateY,
  mat4RotateZ, mat4Scale, mat4Translate, quatRotate, sub,
} from './math3d.js';
import { SpriteBatch } from './gl-renderer.js';
import { HINGES, buildAircraftMeshes } from './aircraft-mesh.js';
import { RING_RADIUS, buildRingMesh } from './rings.js';
import { MeshBuilder } from './mesh-builder.js';
import { SUN_DIR, findStrip, stripDirection } from './world-layout.js';

function hingeX(model, y, z, angle) {
  return mat4Compose(model, mat4Translate(0, y, z), mat4RotateX(angle), mat4Translate(0, -y, -z));
}

function buildCrate() {
  const mb = new MeshBuilder();
  mb.box(0, 0, 0, 1.4, 1.1, 1.4, [0.62, 0.42, 0.22, 0]);
  mb.box(0, 0, 0, 1.46, 0.2, 1.46, [0.85, 0.2, 0.15, 0]);
  return mb.build();
}

function buildChute() {
  const mb = new MeshBuilder();
  mb.blob(0, 6, 0, 3.6, 1.8, 3.6, [0.98, 0.5, 0.16, 0.15], 4, 8, [0.95, 0.92, 0.85, 0.1]);
  for (const [x, z] of [[2.8, 0], [-2.8, 0], [0, 2.8], [0, -2.8]]) mb.box(x / 2, 3, z / 2, 0.06, 5.2, 0.06, [0.9, 0.9, 0.9, 0]);
  return mb.build();
}

function buildTargetMarker() {
  const mb = new MeshBuilder();
  const ring = (r0, r1, color) => {
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
      const p = (r, a) => [Math.cos(a) * r, 0, Math.sin(a) * r];
      mb.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1), color);
    }
  };
  ring(0, 6, [1, 0.5, 0.15, 0.6]);
  ring(6, 14, [0.97, 0.95, 0.9, 0.4]);
  ring(14, 20, [1, 0.5, 0.15, 0.6]);
  ring(20, 26, [0.97, 0.95, 0.9, 0.4]);
  return mb.build();
}

function buildWindsock() {
  const mb = new MeshBuilder();
  mb.box(0, 4, 0, 0.18, 8, 0.18, [0.8, 0.8, 0.8, 0]);
  mb.push(mat4Compose(mat4Translate(0, 7.8, 0), mat4RotateX(-Math.PI / 2)));
  for (let k = 0; k < 4; k++) mb.frustum(0, k * 0.9, 0, 0.55 - k * 0.08, (k + 1) * 0.9, 0.55 - (k + 1) * 0.08, 8, k % 2 ? [0.96, 0.95, 0.92, 0] : [1, 0.45, 0.1, 0]);
  mb.pop();
  return mb.build();
}

export class SceneRenderer {
  constructor(renderer, world) {
    this.r = renderer;
    this.world = world;
    const up = (m) => renderer.uploadMesh(m);
    this.terrain = up(world.terrain.buildMesh());
    this.water = renderer.uploadWater(world.terrain.buildWaterGrid(2));
    this.stripBase = up(world.airstrips.base);
    this.stripPaint = up(world.airstrips.paint);
    this.stripProps = up(world.airstrips.props);
    this.trees = up(world.scenery.trees);
    this.buildings = up(world.scenery.buildings);
    this.clouds = up(world.clouds);
    const ac = buildAircraftMeshes();
    this.plane = Object.fromEntries(Object.entries(ac).map(([k, v]) => [k, up(v)]));
    this.ring = up(buildRingMesh());
    this.crate = up(buildCrate());
    this.chute = up(buildChute());
    this.marker = up(buildTargetMarker());
    this.windsock = up(buildWindsock());
    const port = findStrip('port');
    const d = stripDirection(port);
    this.sockPos = [port.x - d[0] * 380 + d[2] * 40, port.elev, port.z - d[2] * 380 - d[0] * 40];
    this.smoke = new SpriteBatch();
    this.glow = new SpriteBatch();
    this.debris = new SpriteBatch();
    this.identity = mat4Identity();
  }

  drawAircraft(ac, cockpit) {
    const r = this.r, P = this.plane;
    const model = mat4FromQuatPos(ac.q, ac.pos);
    const tint = ac.crashed ? [0.42, 0.38, 0.36] : [1, 1, 1];
    if (!cockpit) {
      r.drawMesh(P.body, model, { tint });
      const wt = HINGES.wingTrailing, a = ac.surfaces.aileron * 0.38, f = ac.flapAngle * 0.62;
      r.drawMesh(P.aileronL, hingeX(model, wt.y, wt.z, a), { tint });
      r.drawMesh(P.aileronR, hingeX(model, wt.y, wt.z, -a), { tint });
      r.drawMesh(P.flapL, hingeX(model, wt.y, wt.z, f), { tint });
      r.drawMesh(P.flapR, hingeX(model, wt.y, wt.z, f), { tint });
      r.drawMesh(P.elevator, hingeX(model, HINGES.elevator.y, HINGES.elevator.z, -ac.surfaces.elevator * 0.42), { tint });
      const rz = HINGES.rudder.z;
      r.drawMesh(P.rudder, mat4Compose(model, mat4Translate(0, 0, rz), mat4RotateY(ac.surfaces.rudder * 0.45), mat4Translate(0, 0, -rz)), { tint });
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
    const viewProj = r.beginFrame({ view, proj, camPos: camera.eye, sunDir: SUN_DIR, time, fogDensity: 1 / 6200 });
    const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]];
    this.smoke.clear();
    this.glow.clear();
    this.debris.clear();

    r.drawSky();
    r.drawMesh(this.terrain, this.identity);
    r.drawWater(this.water);
    r.drawMesh(this.stripBase, this.identity, { decal: 1 });
    r.drawMesh(this.stripPaint, this.identity, { decal: 2 });
    r.drawMesh(this.stripProps, this.identity);
    r.drawMesh(this.trees, this.identity);
    r.drawMesh(this.buildings, this.identity);
    r.drawMesh(this.clouds, this.identity);
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
    return viewProj;
  }
}

