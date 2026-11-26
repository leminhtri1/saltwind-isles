// Synthesised WebAudio: engine drone following RPM, wind with airspeed, stall horn, and event cues.

export class FlightAudio {
	ctx = null;
	muted = false;

	node(n, props, ...chain) {
		for (const [k, v] of Object.entries(props)) if (n[k] instanceof AudioParam) n[k].value = v; else n[k] = v;
		chain.reduce((a, b) => a.connect(b), n);
		return n;
	}

	start() {
		if (this.ctx) return void (this.ctx.state === 'suspended' && this.ctx.resume());
		if (!window.AudioContext) return;
		const ctx = (this.ctx = new AudioContext()), N = this.node.bind(this), gain = (g, to) => N(ctx.createGain(), { gain: g }, to), filter = (p, to) => N(ctx.createBiquadFilter(), p, to);
		const len = ctx.sampleRate * 2, buf = (this.noise = ctx.createBuffer(1, len, ctx.sampleRate)), data = buf.getChannelData(0);
		for (let i = 0, seed = 1; i < len; i++) data[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
		this.master = gain(0.5, ctx.destination);
		this.engineGain = gain(0, this.master);
		this.engineFilter = filter({ type: 'lowpass', frequency: 600 }, this.engineGain);
		this.windGain = gain(0, this.master);
		this.windFilter = filter({ type: 'bandpass', Q: 0.6 }, this.windGain);
		this.hornGain = gain(0, this.master);
		this.osc1 = N(ctx.createOscillator(), { type: 'sawtooth' }, this.engineFilter);
		this.osc2 = N(ctx.createOscillator(), { type: 'square' }, gain(0.35, this.engineFilter));
		this.horn = N(ctx.createOscillator(), { type: 'square', frequency: 520 }, filter({ type: 'lowpass', frequency: 1400 }, this.hornGain));
		for (const s of [this.osc1, this.osc2, this.horn, N(ctx.createBufferSource(), { buffer: buf, loop: true }, this.windFilter)]) s.start();
	}

	update(ac, active) {
		if (!this.ctx) return;
		const t = this.ctx.currentTime, set = (p, v, k) => p.setTargetAtTime(v, t, k), on = active && !ac.crashed && !this.muted, f = 22 + ac.rpm / 60, v = ac.airspeed;
		set(this.osc1.frequency, f, 0.05);
		set(this.osc2.frequency, f * 2.01, 0.05);
		set(this.engineFilter.frequency, 300 + ac.rpm * 0.45, 0.1);
		set(this.engineGain.gain, on ? 0.05 + (Math.min(ac.rpm, 3000) / 3000) * 0.14 : 0, 0.08);
		set(this.windFilter.frequency, 300 + v * 25, 0.2);
		set(this.windGain.gain, on ? Math.min(0.35, (v * v) / 12000) : 0, 0.2);
		set(this.hornGain.gain, on && ac.stallWarning ? 0.08 : 0, 0.03);
	}

	cue(duration, freq, level, q = 1, tone = null, start = 0) {
		const ctx = this.ctx, t = ctx.currentTime + start, g = this.node(ctx.createGain(), {}, this.master);
		g.gain.setValueAtTime(tone ? 0.0001 : level, t);
		if (tone) g.gain.exponentialRampToValueAtTime(level, t + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		const src = tone ? this.node(ctx.createOscillator(), { type: tone, frequency: freq }, g) : this.node(ctx.createBufferSource(), { buffer: this.noise }, this.node(ctx.createBiquadFilter(), { type: 'bandpass', frequency: freq, Q: q }, g));
		src.start(t, tone ? 0 : Math.random());
		src.stop(t + duration + 0.05);
	}

	play(name, strength = 1) {
		if (!this.ctx || this.muted) return;
		const chime = (notes, gap, len, type) => notes.forEach((f, i) => this.cue(len, f, 0.12, 1, type, i * gap));
		if (name === 'ring') chime([880, 1108, 1318], 0.07, 0.5, 'sine');
		else if (name === 'medal') chime([523, 659, 784, 1046], 0.12, 0.6, 'triangle');
		else if (name === 'warn') this.cue(0.3, 330, 0.1, 1, 'square');
		else if (name === 'touchdown') { this.cue(0.25, 2200, 0.25 * strength, 2); this.cue(0.15, 500, 0.2 * strength); }
		else if (name === 'crash') { this.cue(1.6, 180, 0.9, 0.5); this.cue(0.8, 900, 0.5, 0.7); }
		else this.cue(0.3, name === 'drop' ? 400 : 150, 0.25, 1.5);
	}
}
