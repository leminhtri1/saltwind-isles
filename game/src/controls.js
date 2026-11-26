// Keyboard and mouse: ramped stick keys, left-drag mouse yoke, right-drag look, wheel and number-key throttle.

const KEYS = {
	pitchDown: ['KeyW', 'ArrowUp'], pitchUp: ['KeyS', 'ArrowDown'], rollLeft: ['KeyA', 'ArrowLeft'], rollRight: ['KeyD', 'ArrowRight'],
	yawLeft: ['KeyQ'], yawRight: ['KeyE'], power: ['ShiftLeft', 'ShiftRight', 'Equal'], idle: ['ControlLeft', 'ControlRight', 'Minus'],
};
const GAME_KEYS = new Set([...Object.values(KEYS).flat(), 'Space', 'Tab']);
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

export class Controls {
	keys = new Set();
	pressed = new Set();
	axes = { pitch: 0, roll: 0, yaw: 0 };
	wheel = 0;
	invertPitch = false;
	yoke = null;
	look = { active: false, dx: 0, dy: 0, x: 0, y: 0 };
	mouse = { x: 0, y: 0, clicked: false };

	constructor(element) {
		const on = (target, type, fn, opts) => target.addEventListener(type, fn, opts), l = this.look;
		on(window, 'keydown', (e) => {
			if (GAME_KEYS.has(e.code)) e.preventDefault();
			if (!e.repeat) this.pressed.add(e.code);
			this.keys.add(e.code);
		});
		on(window, 'keyup', (e) => this.keys.delete(e.code));
		on(window, 'blur', () => this.keys.clear());
		on(element, 'contextmenu', (e) => e.preventDefault());
		on(element, 'mousedown', ({ clientX: x, clientY: y, button }) => {
			Object.assign(this.mouse, { x, y, clicked: true });
			if (button === 0) this.yoke = { x0: x, y0: y, x, y };
			if (button === 2) Object.assign(l, { active: true, x, y });
		});
		on(window, 'mousemove', ({ clientX: x, clientY: y }) => {
			Object.assign(this.mouse, { x, y });
			if (this.yoke) Object.assign(this.yoke, { x, y });
			if (l.active) Object.assign(l, { dx: l.dx + x - l.x, dy: l.dy + y - l.y, x, y });
		});
		on(window, 'mouseup', (e) => {
			if (e.button === 0) this.yoke = null;
			if (e.button === 2) l.active = false;
		});
		on(element, 'wheel', (e) => {
			e.preventDefault();
			this.wheel -= Math.sign(e.deltaY) * 0.05;
		}, { passive: false });
	}

	down(name) { return KEYS[name].some((c) => this.keys.has(c)) ? 1 : 0; }

	consume(code) { return this.pressed.delete(code); }

	sample(dt) {
		const flip = this.invertPitch ? -1 : 1, a = this.axes, y = this.yoke, l = this.look;
		const ramp = (k, t) => {
			const v = a[k], rate = (t === 0 || Math.sign(t) !== Math.sign(v) ? 6 : 3.2) * dt;
			a[k] = Math.abs(t - v) < rate ? t : v + Math.sign(t - v) * rate;
		};
		ramp('pitch', (this.down('pitchUp') - this.down('pitchDown')) * flip);
		ramp('roll', this.down('rollRight') - this.down('rollLeft'));
		ramp('yaw', this.down('yawRight') - this.down('yawLeft'));
		let throttleSet = this.consume('Backquote') ? 0 : null;
		for (let d = 0; d <= 9; d++) if (this.consume('Digit' + d)) throttleSet = d === 0 ? 1 : d / 10;
		const out = {
			pitch: y ? clamp1((y.y - y.y0) / 140) * flip : a.pitch, roll: y ? clamp1((y.x - y.x0) / 140) : a.roll, yaw: a.yaw,
			throttleDelta: this.wheel + (this.down('power') - this.down('idle')) * 0.6 * dt, throttleSet, brakes: this.keys.has('KeyB'), lookDx: l.dx, lookDy: l.dy, looking: l.active,
		};
		this.wheel = l.dx = l.dy = 0;
		return out;
	}

	endFrame() {
		this.pressed.clear();
		this.mouse.clicked = false;
	}
}
