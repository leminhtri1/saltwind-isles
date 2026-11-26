// All sound is synthesised with WebAudio: a two-oscillator engine drone that follows the RPM, wind
// noise that rises with airspeed, the stall horn, and short cues for touchdowns, rings, crate drops
// and crashes. Nothing is loaded from files.

export class FlightAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  /** Create the graph on the first user gesture (browsers require one). */
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);
    // engine: sawtooth + square through a low-pass
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    this.engineFilter = lp;
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    this.osc1.connect(lp);
    this.osc2.connect(g2).connect(lp);
    lp.connect(this.engineGain).connect(this.master);
    this.osc1.start();
    this.osc2.start();
    // wind: looping noise through a band-pass
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    this.noise = buf;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();
    // stall horn
    this.horn = ctx.createOscillator();
    this.horn.type = 'square';
    this.horn.frequency.value = 520;
    this.hornGain = ctx.createGain();
    this.hornGain.gain.value = 0;
    const hlp = ctx.createBiquadFilter();
    hlp.type = 'lowpass';
    hlp.frequency.value = 1400;
    this.horn.connect(hlp).connect(this.hornGain).connect(this.master);
    this.horn.start();
  }

  /** Follow the aircraft each frame. */
  update(ac, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = active && ac && !ac.crashed && !this.muted;
    const rpm = ac ? ac.rpm : 0;
    const f = 22 + rpm / 60 * 1.0;
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 2.01, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(300 + rpm * 0.45, t, 0.1);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + Math.min(rpm, 3000) / 3000 * 0.14 : 0, t, 0.08);
    const v = ac ? ac.airspeed : 0;
    this.windFilter.frequency.setTargetAtTime(300 + v * 25, t, 0.2);
    this.windGain.gain.setTargetAtTime(on ? Math.min(0.35, v * v / 12000) : 0, t, 0.2);
    this.hornGain.gain.setTargetAtTime(on && ac.stallWarning ? 0.08 : 0, t, 0.03);
  }

  burst(duration, freq, gain, q = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + duration);
  }

  tone(freq, start, duration, gain, type = 'sine') {
    const ctx = this.ctx, t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  play(name, strength = 1) {
    if (!this.ctx || this.muted) return;
    if (name === 'ring') [880, 1108, 1318].forEach((f, i) => this.tone(f, i * 0.07, 0.5, 0.12));
    else if (name === 'touchdown') { this.burst(0.25, 2200, 0.25 * strength, 2); this.burst(0.15, 500, 0.2 * strength); }
    else if (name === 'crash') { this.burst(1.6, 180, 0.9, 0.5); this.burst(0.8, 900, 0.5, 0.7); }
    else if (name === 'drop') this.burst(0.3, 400, 0.25, 1.5);
    else if (name === 'thud') this.burst(0.2, 150, 0.3, 1);
    else if (name === 'click') this.tone(1500, 0, 0.05, 0.05, 'square');
    else if (name === 'medal') [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.12, 0.6, 0.12, 'triangle'));
    else if (name === 'warn') this.tone(330, 0, 0.3, 0.1, 'square');
  }
}
