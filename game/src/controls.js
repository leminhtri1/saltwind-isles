// Keyboard and mouse input. Keys ramp the stick smoothly so small taps make small corrections;
// holding the left mouse button turns the mouse into a yoke; right-drag looks around; the wheel
// and number keys set the throttle.

const PITCH_DOWN = ['KeyW', 'ArrowUp'];
const PITCH_UP = ['KeyS', 'ArrowDown'];
const ROLL_LEFT = ['KeyA', 'ArrowLeft'];
const ROLL_RIGHT = ['KeyD', 'ArrowRight'];
const GAME_KEYS = new Set([...PITCH_DOWN, ...PITCH_UP, ...ROLL_LEFT, ...ROLL_RIGHT, 'Space', 'Tab', 'KeyQ', 'KeyE']);

export class Controls {
  constructor(element) {
    this.keys = new Set();
    this.pressed = new Set();
    this.axes = { pitch: 0, roll: 0, yaw: 0 };
    this.throttleDelta = 0;
    this.throttleSet = null;
    this.invertPitch = false;
    this.yoke = null;
    this.look = { active: false, dx: 0, dy: 0, lastX: 0, lastY: 0 };
    this.mouse = { x: 0, y: 0, clicked: false };
    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    element.addEventListener('contextmenu', (e) => e.preventDefault());
    element.addEventListener('mousedown', (e) => {
      this.mouse.clicked = true;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (e.button === 0) this.yoke = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      if (e.button === 2) Object.assign(this.look, { active: true, lastX: e.clientX, lastY: e.clientY });
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (this.yoke) { this.yoke.x = e.clientX; this.yoke.y = e.clientY; }
      if (this.look.active) {
        this.look.dx += e.clientX - this.look.lastX;
        this.look.dy += e.clientY - this.look.lastY;
        this.look.lastX = e.clientX;
        this.look.lastY = e.clientY;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.yoke = null;
      if (e.button === 2) this.look.active = false;
    });
    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.throttleDelta -= Math.sign(e.deltaY) * 0.05;
    }, { passive: false });
  }

  down(codes) { return codes.some((c) => this.keys.has(c)); }

  /** True once per key press. */
  consume(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** Update the smoothed stick and rudder; returns the pilot's inputs for this frame. */
  sample(dt) {
    let pitchT = (this.down(PITCH_UP) ? 1 : 0) - (this.down(PITCH_DOWN) ? 1 : 0);
    if (this.invertPitch) pitchT = -pitchT;
    const rollT = (this.down(ROLL_RIGHT) ? 1 : 0) - (this.down(ROLL_LEFT) ? 1 : 0);
    const yawT = (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0);
    const ramp = (v, t) => {
      const rate = t === 0 || Math.sign(t) !== Math.sign(v) ? 6 : 3.2;
      const d = t - v;
      return Math.abs(d) < rate * dt ? t : v + Math.sign(d) * rate * dt;
    };
    this.axes.pitch = ramp(this.axes.pitch, pitchT);
    this.axes.roll = ramp(this.axes.roll, rollT);
    this.axes.yaw = ramp(this.axes.yaw, yawT);
    let { pitch, roll } = this.axes;
    if (this.yoke) {
      const k = 1 / 140;
      pitch = Math.max(-1, Math.min(1, (this.yoke.y - this.yoke.y0) * k)) * (this.invertPitch ? -1 : 1);
      roll = Math.max(-1, Math.min(1, (this.yoke.x - this.yoke.x0) * k));
    }
    let throttle = this.throttleDelta;
    this.throttleDelta = 0;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('Equal')) throttle += 0.6 * dt;
    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('Minus')) throttle -= 0.6 * dt;
    for (let d = 0; d <= 9; d++) if (this.consume('Digit' + d)) this.throttleSet = d === 0 ? 1 : d / 10;
    if (this.consume('Backquote')) this.throttleSet = 0;
    const set = this.throttleSet;
    this.throttleSet = null;
    const lookDx = this.look.dx, lookDy = this.look.dy;
    this.look.dx = 0;
    this.look.dy = 0;
    return {
      pitch, roll, yaw: this.axes.yaw, throttleDelta: throttle, throttleSet: set,
      brakes: this.keys.has('KeyB'), lookDx, lookDy, looking: this.look.active,
    };
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
