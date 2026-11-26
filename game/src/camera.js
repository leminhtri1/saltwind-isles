// Chase camera on a smoothed offset, cockpit eye, and a slow orbit for menus and wrecks; right-drag looks.
import { add, clamp, damp, lerp3, madd, normalize, quatRotate, scale } from './math3d.js';

export class FlightCamera {
	mode = 'chase';
	offset = null;
	lookYaw = 0;
	lookPitch = 0;
	orbitAngle = 0;

	toggle() {
		this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
		this.offset = null;
	}

	look(input, dt) {
		if (input && input.looking) {
			this.lookYaw = clamp(this.lookYaw - input.lookDx * 0.006, -Math.PI, Math.PI);
			this.lookPitch = clamp(this.lookPitch - input.lookDy * 0.004, -0.6, 0.8);
		} else {
			this.lookYaw *= 1 - damp(2.5, dt);
			this.lookPitch *= 1 - damp(2.5, dt);
		}
	}

	follow(ac, dt, input, ground) {
		this.look(input, dt);
		const fwd = quatRotate(ac.q, [0, 0, -1]);
		const acUp = quatRotate(ac.q, [0, 1, 0]);
		if (this.mode === 'cockpit') {
			this.eye = add(ac.pos, quatRotate(ac.q, [0, 0.82, -0.85]));
			const cy = Math.cos(this.lookYaw), sy = Math.sin(this.lookYaw);
			const local = [-sy * Math.cos(this.lookPitch), Math.sin(this.lookPitch) - 0.08, -cy * Math.cos(this.lookPitch)];
			this.target = add(this.eye, quatRotate(ac.q, local));
			this.up = acUp;
			this.fov = 74;
			return;
		}
		const flat = normalize([fwd[0], 0, fwd[2]]);
		const dir = normalize(lerp3(flat[0] || flat[2] ? flat : fwd, fwd, 0.4));
		const cy = Math.cos(this.lookYaw), sy = Math.sin(this.lookYaw);
		const back = [-(dir[0] * cy - dir[2] * sy), -dir[1], -(dir[0] * sy + dir[2] * cy)];
		const dist = 19, height = 5.6 + this.lookPitch * 14;
		const desired = madd(scale(back, dist), [0, 1, 0], height);
		if (!this.offset) this.offset = desired;
		this.offset = lerp3(this.offset, desired, damp(4.5, dt));
		this.eye = add(ac.pos, this.offset);
		const floor = Math.max(0, ground(this.eye[0], this.eye[2])) + 2;
		if (this.eye[1] < floor) this.eye[1] = floor;
		this.target = madd(madd(ac.pos, fwd, 8), [0, 1, 0], 1.2);
		this.up = normalize(lerp3([0, 1, 0], acUp, 0.22));
		this.fov = 50;
	}

	orbit(center, radius, height, dt, speed = 0.08, lift = 0, side = 0) {
		this.orbitAngle += dt * speed;
		const a = this.orbitAngle, c = Math.cos(a), s = Math.sin(a);
		this.eye = [center[0] + c * radius, center[1] + height, center[2] + s * radius];
		this.target = [center[0] - s * side, center[1] + lift, center[2] + c * side];
		this.up = [0, 1, 0];
		this.fov = 55;
	}
}
