// Keyboard and mouse: ramped stick keys, left-drag mouse yoke, right-drag look, wheel and number-key throttle.

const KEYS = {
	pitchDown: ['KeyW', 'ArrowUp'], pitchUp: ['KeyS', 'ArrowDown'], rollLeft: ['KeyA', 'ArrowLeft'], rollRight: ['KeyD', 'ArrowRight'],
	yawLeft: ['KeyQ'], yawRight: ['KeyE'], power: ['ShiftLeft', 'ShiftRight', 'Equal'], idle: ['ControlLeft', 'ControlRight', 'Minus'],
};
const GAME_KEYS = new Set([...Object.values(KEYS).flat(), 'Space', 'Tab']);
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

export class Controls {
	constructor(element) {
		Object.assign(this, { keys: new Set(), pressed: new Set(), axes: { pitch: 0, roll: 0, yaw: 0 }, wheel: 0, invertPitch: false, yoke: null });
		this.look = { active: false, dx: 0, dy: 0, x: 0, y: 0 };
		this.mouse = { x: 0, y: 0, clicked: false };
		const on = (target, type, fn, opts) => target.addEventListener(type, fn, opts);
		on(window, 'keydown', (e) => {
			if (GAME_KEYS.has(e.code)) e.preventDefault();
			if (!e.repeat) this.pressed.add(e.code);
			this.keys.add(e.code);
		});
		on(window, 'keyup', (e) => this.keys.delete(e.code));
		on(window, 'blur', () => this.keys.clear());
		on(element, 'contextmenu', (e) => e.preventDefault());
		on(element, 'mousedown', (e) => {
			Object.assign(this.mouse, { x: e.clientX, y: e.clientY, clicked: true });
			if (e.button === 0) this.yoke = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
			if (e.button === 2) Object.assign(this.look, { active: true, x: e.clientX, y: e.clientY });
		});
		on(window, 'mousemove', (e) => {
			Object.assign(this.mouse, { x: e.clientX, y: e.clientY });
			if (this.yoke) Object.assign(this.yoke, { x: e.clientX, y: e.clientY });
			const l = this.look;
			if (l.active) Object.assign(l, { dx: l.dx + e.clientX - l.x, dy: l.dy + e.clientY - l.y, x: e.clientX, y: e.clientY });
		});
		on(window, 'mouseup', (e) => {
			if (e.button === 0) this.yoke = null;
			if (e.button === 2) this.look.active = false;
		});
		on(element, 'wheel', (e) => {
			e.preventDefault();
			this.wheel -= Math.sign(e.deltaY) * 0.05;
		}, { passive: false });
	}

	down(name) { return KEYS[name].some((c) => this.keys.has(c)) ? 1 : 0; }

	consume(code) { return this.pressed.delete(code); }

	sample(dt) {
		const flip = this.invertPitch ? -1 : 1;
		const ramp = (v, t) => {
			const rate = (t === 0 || Math.sign(t) !== Math.sign(v) ? 6 : 3.2) * dt;
			return Math.abs(t - v) < rate ? t : v + Math.sign(t - v) * rate;
		};
		const a = this.axes;
		a.pitch = ramp(a.pitch, (this.down('pitchUp') - this.down('pitchDown')) * flip);
		a.roll = ramp(a.roll, this.down('rollRight') - this.down('rollLeft'));
		a.yaw = ramp(a.yaw, this.down('yawRight') - this.down('yawLeft'));
		let { pitch, roll } = a, throttleSet = null;
		if (this.yoke) {
			pitch = clamp1((this.yoke.y - this.yoke.y0) / 140) * flip;
			roll = clamp1((this.yoke.x - this.yoke.x0) / 140);
		}
		const throttleDelta = this.wheel + (this.down('power') - this.down('idle')) * 0.6 * dt;
		for (let d = 0; d <= 9; d++) if (this.consume('Digit' + d)) throttleSet = d === 0 ? 1 : d / 10;
		if (this.consume('Backquote')) throttleSet = 0;
		const { dx: lookDx, dy: lookDy, active: looking } = this.look;
		this.wheel = this.look.dx = this.look.dy = 0;
		return { pitch, roll, yaw: a.yaw, throttleDelta, throttleSet, brakes: this.keys.has('KeyB'), lookDx, lookDy, looking };
	}

	endFrame() {
		this.pressed.clear();
		this.mouse.clicked = false;
	}
}
