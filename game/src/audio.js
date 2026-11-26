// Synthesised WebAudio: engine drone following RPM, wind with airspeed, stall horn, and event cues.

export class FlightAudio {
	constructor() {
		this.ctx = null;
		this.muted = false;
	}

	node(make, props = {}, ...chain) {
		const n = make;
		for (const [k, v] of Object.entries(props)) if (n[k] instanceof AudioParam) n[k].value = v; else n[k] = v;
		chain.reduce((a, b) => a.connect(b), n);
		return n;
	}

	/** Build the graph on the first user gesture (browsers require one). */
	start() {
		if (this.ctx) return void (this.ctx.state === 'suspended' && this.ctx.resume());
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return;
		const ctx = (this.ctx = new AC());
		const N = this.node.bind(this);
		this.master = N(ctx.createGain(), { gain: 0.5 }, ctx.destination);
		// engine: sawtooth and square an octave apart, through a low-pass that opens with RPM
		this.engineGain = N(ctx.createGain(), { gain: 0 }, this.master);
		this.engineFilter = N(ctx.createBiquadFilter(), { type: 'lowpass', frequency: 600 }, this.engineGain);
		this.osc1 = N(ctx.createOscillator(), { type: 'sawtooth' }, this.engineFilter);
		this.osc2 = N(ctx.createOscillator(), { type: 'square' }, N(ctx.createGain(), { gain: 0.35 }, this.engineFilter));
		// wind: looping seeded noise through a band-pass
		const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
		for (let i = 0, seed = 1; i < len; i++) data[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
		this.noise = buf;
		this.windGain = N(ctx.createGain(), { gain: 0 }, this.master);
		this.windFilter = N(ctx.createBiquadFilter(), { type: 'bandpass', Q: 0.6 }, this.windGain);
		const wind = N(ctx.createBufferSource(), { buffer: buf, loop: true }, this.windFilter);
		// stall horn
		this.hornGain = N(ctx.createGain(), { gain: 0 }, this.master);
		this.horn = N(ctx.createOscillator(), { type: 'square', frequency: 520 }, N(ctx.createBiquadFilter(), { type: 'lowpass', frequency: 1400 }, this.hornGain));
		for (const s of [this.osc1, this.osc2, wind, this.horn]) s.start();
	}

	/** Follow the aircraft each frame. */
	update(ac, active) {
		if (!this.ctx) return;
		const t = this.ctx.currentTime, set = (p, v, k) => p.setTargetAtTime(v, t, k);
		const on = active && ac && !ac.crashed && !this.muted, rpm = ac ? ac.rpm : 0, v = ac ? ac.airspeed : 0;
		set(this.osc1.frequency, 22 + rpm / 60, 0.05);
		set(this.osc2.frequency, (22 + rpm / 60) * 2.01, 0.05);
		set(this.engineFilter.frequency, 300 + rpm * 0.45, 0.1);
		set(this.engineGain.gain, on ? 0.05 + (Math.min(rpm, 3000) / 3000) * 0.14 : 0, 0.08);
		set(this.windFilter.frequency, 300 + v * 25, 0.2);
		set(this.windGain.gain, on ? Math.min(0.35, (v * v) / 12000) : 0, 0.2);
		set(this.hornGain.gain, on && ac.stallWarning ? 0.08 : 0, 0.03);
	}

	/** A decaying burst of filtered noise (tyres, thuds, crashes). */
	burst(duration, freq, gain, q = 1) {
		const ctx = this.ctx, t = ctx.currentTime;
		const g = this.node(ctx.createGain(), {}, this.master);
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + duration);
		const src = this.node(ctx.createBufferSource(), { buffer: this.noise }, this.node(ctx.createBiquadFilter(), { type: 'bandpass', frequency: freq, Q: q }, g));
		src.start(t, Math.random());
		src.stop(t + duration);
	}

	/** A short enveloped tone (chimes and warnings). */
	tone(freq, start, duration, gain, type = 'sine') {
		const ctx = this.ctx, t = ctx.currentTime + start;
		const g = this.node(ctx.createGain(), {}, this.master);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		const o = this.node(ctx.createOscillator(), { type, frequency: freq }, g);
		o.start(t);
		o.stop(t + duration + 0.05);
	}

	play(name, strength = 1) {
		if (!this.ctx || this.muted) return;
		if (name === 'ring') [880, 1108, 1318].forEach((f, i) => this.tone(f, i * 0.07, 0.5, 0.12));
		else if (name === 'medal') [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.12, 0.6, 0.12, 'triangle'));
		else if (name === 'warn') this.tone(330, 0, 0.3, 0.1, 'square');
		else if (name === 'touchdown') { this.burst(0.25, 2200, 0.25 * strength, 2); this.burst(0.15, 500, 0.2 * strength); }
		else if (name === 'crash') { this.burst(1.6, 180, 0.9, 0.5); this.burst(0.8, 900, 0.5, 0.7); }
		else if (name === 'drop') this.burst(0.3, 400, 0.25, 1.5);
		else if (name === 'thud') this.burst(0.2, 150, 0.3, 1);
	}
}
