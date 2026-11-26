// Particles that make events readable: crash fireballs, debris and a rising smoke column, splashes,
// tyre smoke and dust on touchdown, a smoke trail from a damaged engine, sparkles through rings
// and the coloured smoke flares marking drop zones.
import { createRandom } from './noise.js';

export class Effects {
  constructor(seed = 3) {
    this.parts = [];
    this.rnd = createRandom(seed);
    this.emitters = [];
  }

  clear() {
    this.parts.length = 0;
    this.emitters.length = 0;
  }

  spawn(p) {
    if (this.parts.length < 1600) this.parts.push({ age: 0, grow: 0, drag: 1, lift: 0, ...p });
  }

  jitter(s) { return (this.rnd() * 2 - 1) * s; }

  /** A fireball, flying debris and a smoke column that keeps rising. */
  crash(pos, water) {
    const r = () => this.rnd();
    for (let i = 0; i < 40; i++) {
      this.spawn({
        pos: [...pos], vel: [this.jitter(14), 6 + r() * 16, this.jitter(14)], life: 2 + r() * 2, size: 0.5 + r() * 0.6,
        color: water ? [0.9, 0.95, 1, 0.9] : [0.12, 0.1, 0.09, 1], kind: 'debris', gravity: 1, drag: 0.4,
      });
    }
    if (water) {
      for (let i = 0; i < 30; i++) this.spawn({ pos: [...pos], vel: [this.jitter(6), 8 + r() * 10, this.jitter(6)], life: 1.5 + r(), size: 2.5, grow: 3, color: [0.92, 0.96, 1, 0.8], kind: 'smoke', gravity: 1 });
    } else {
      for (let i = 0; i < 18; i++) this.spawn({ pos: [...pos], vel: [this.jitter(8), 3 + r() * 6, this.jitter(8)], life: 0.9 + r() * 0.6, size: 4 + r() * 3, grow: 6, color: [1, 0.55, 0.15, 1], kind: 'glow' });
      this.emitters.push({ pos: [...pos], kind: 'wreck', t: 0 });
    }
  }

  touchdown(pos, grass, strength) {
    for (let i = 0; i < 8 + strength * 6; i++) {
      this.spawn({
        pos: [pos[0] + this.jitter(1.5), pos[1] + 0.3, pos[2] + this.jitter(1.5)], vel: [this.jitter(2), 1 + this.rnd() * 1.5, this.jitter(2)],
        life: 1.2 + this.rnd(), size: 0.9, grow: 2.2, color: grass ? [0.72, 0.64, 0.45, 0.5] : [0.92, 0.92, 0.92, 0.55], kind: 'smoke',
      });
    }
  }

  ringBurst(pos) {
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      this.spawn({ pos: [...pos], vel: [Math.cos(a) * 14 + this.jitter(3), Math.sin(a) * 14 + this.jitter(3), this.jitter(4)], life: 0.9, size: 1.4, color: [1, 0.8, 0.35, 1], kind: 'glow', drag: 2 });
    }
  }

  engineSmoke(pos, vel, damage) {
    if (this.rnd() > (damage - 45) / 40) return;
    this.spawn({ pos: [...pos], vel: [vel[0] * 0.2, vel[1] * 0.2 + 0.5, vel[2] * 0.2], life: 2.5, size: 0.8, grow: 2.5, color: [0.25, 0.24, 0.24, 0.45], kind: 'smoke' });
  }

  flare(pos) {
    this.spawn({ pos: [pos[0] + this.jitter(1), pos[1] + 1, pos[2] + this.jitter(1)], vel: [this.jitter(0.6), 4 + this.rnd() * 2, this.jitter(0.6)], life: 5, size: 2, grow: 3.5, color: [1, 0.45, 0.18, 0.6], kind: 'smoke', lift: 0.3 });
  }

  update(dt, wind) {
    for (const e of this.emitters) {
      e.t += dt;
      if (e.kind === 'wreck') {
        if (e.t < 25 && this.rnd() < dt * 22) {
          this.spawn({ pos: [e.pos[0] + this.jitter(2), e.pos[1] + 1, e.pos[2] + this.jitter(2)], vel: [this.jitter(1), 5 + this.rnd() * 3, this.jitter(1)], life: 6, size: 2.5, grow: 4.5, color: [0.16, 0.15, 0.15, 0.55], kind: 'smoke', lift: 0.4 });
        }
        if (e.t < 12 && this.rnd() < dt * 18) {
          this.spawn({ pos: [e.pos[0] + this.jitter(2), e.pos[1] + 0.5, e.pos[2] + this.jitter(2)], vel: [this.jitter(1), 2 + this.rnd() * 2, this.jitter(1)], life: 0.8, size: 2.5, grow: 1, color: [1, 0.5, 0.12, 0.9], kind: 'glow' });
        }
      }
    }
    for (const p of this.parts) {
      p.age += dt;
      if (p.gravity) p.vel[1] -= 9.81 * dt * p.gravity;
      else p.vel[1] += p.lift * dt;
      const k = Math.exp(-p.drag * dt);
      p.vel[0] = (p.vel[0] - wind[0]) * k + wind[0];
      p.vel[2] = (p.vel[2] - wind[2]) * k + wind[2];
      if (!p.gravity) p.vel[1] *= k;
      p.pos[0] += p.vel[0] * dt;
      p.pos[1] += p.vel[1] * dt;
      p.pos[2] += p.vel[2] * dt;
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
  }

  /** Fill the smoke (alpha) and glow (additive) sprite batches. */
  draw(smoke, glow, debris, right, up) {
    for (const p of this.parts) {
      const t = p.age / p.life;
      const size = p.size + p.grow * t;
      const a = p.color[3] * (p.kind === 'glow' ? 1 - t : Math.min(1, t * 6) * (1 - t));
      const c = [p.color[0], p.color[1], p.color[2], a];
      if (p.kind === 'glow') glow.billboard(p.pos, size, c, right, up);
      else if (p.kind === 'debris') debris.billboard(p.pos, size, [p.color[0], p.color[1], p.color[2], p.color[3]], right, up);
      else smoke.billboard(p.pos, size, c, right, up);
    }
  }
}
