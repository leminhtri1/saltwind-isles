// A north-up chart of the whole archipelago, painted once from the heightfield, with the strips,
// the aircraft arrow, the next waypoint, rings and drop zones drawn live on top.
import { STRIPS, WORLD_HALF, stripDirection } from './world-layout.js';

export class Minimap {
  constructor(world, size = 256) {
    this.size = size;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = -WORLD_HALF + (i + 0.5) / size * WORLD_HALF * 2, z = -WORLD_HALF + (j + 0.5) / size * WORLD_HALF * 2;
        const h = world.terrain.heightAt(x, z);
        let col;
        if (h < 0) {
          const t = Math.min(1, -h / 18);
          col = [40 + (1 - t) * 60, 110 + (1 - t) * 70, 140 + (1 - t) * 30];
        } else if (h < 2.5) col = [222, 200, 150];
        else if (h > 320) col = [240, 240, 240];
        else if (h > 200) col = [150, 135, 120];
        else {
          const f = world.terrain.forestAt(x, z);
          const shade = 1 - h / 500;
          col = [(120 - f * 50) * shade, (160 - f * 40) * shade, (80 - f * 30) * shade];
        }
        const o = (j * size + i) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineCap = 'round';
    for (const s of STRIPS) {
      const d = stripDirection(s);
      const p = (along) => this.toMap(s.x + d[0] * along, s.z + d[2] * along);
      const a = p(-s.length / 2), b = p(s.length / 2);
      ctx.strokeStyle = s.surface === 'asphalt' ? '#202022' : '#f5f0d0';
      ctx.lineWidth = s.surface === 'asphalt' ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    this.base = c;
  }

  toMap(x, z) {
    return [(x + WORLD_HALF) / (WORLD_HALF * 2) * this.size, (z + WORLD_HALF) / (WORLD_HALF * 2) * this.size];
  }

  draw(ctx, cx, cy, R, ac, run) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1418';
    ctx.fill();
    ctx.clip();
    const scale = (R * 2) / this.size;
    ctx.drawImage(this.base, cx - R, cy - R, R * 2, R * 2);
    const M = (p) => {
      const m = this.toMap(p[0], p[2]);
      return [cx - R + m[0] * scale, cy - R + m[1] * scale];
    };
    if (run) {
      run.rings.forEach((r, i) => {
        if (r.passed) return;
        const m = M(r.pos);
        ctx.fillStyle = i === run.ringIndex ? '#ffb02e' : 'rgba(110, 220, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(m[0], m[1], i === run.ringIndex ? 3.5 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      for (const t of run.targets) {
        if (t.done) continue;
        const m = M(t.pos);
        ctx.strokeStyle = '#ff7a2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m[0], m[1], 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (run.waypoint) {
        const m = M(run.waypoint.pos);
        ctx.strokeStyle = '#ff5ad1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(m[0], m[1] - 6);
        ctx.lineTo(m[0] + 6, m[1]);
        ctx.lineTo(m[0], m[1] + 6);
        ctx.lineTo(m[0] - 6, m[1]);
        ctx.closePath();
        ctx.stroke();
      }
    }
    if (ac) {
      const m = M(ac.pos);
      ctx.translate(m[0], m[1]);
      ctx.rotate(ac.headingRad);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5.5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5.5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(125, 255, 168, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd36b';
    ctx.font = `800 ${Math.round(R * 0.16)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - R + R * 0.13);
  }
}
