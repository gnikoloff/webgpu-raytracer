import { mat4, vec3 } from "gl-matrix";

const clamp = (x: number, min = 0, max = 1) => Math.min(Math.max(x, min), max);

class DampedAction {
	private value = 0.0;
	private damping: number;
	constructor() {
		this.damping = 0.5;
	}

	addForce(force: number) {
		this.value += force;
	}

	update() {
		const isActive = this.value * this.value > 0.000001;
		if (isActive) {
			this.value *= this.damping;
		} else {
			this.stop();
		}
		return this.value;
	}

	stop() {
		this.value = 0.0;
	}
}

export class Camera {
	public static readonly UP = vec3.fromValues(0, 1, 0);

	public target = vec3.fromValues(0, 0, -1);
	public viewProjectionMatrix = mat4.create();
	public viewMatrix = mat4.create();
	public projectionMatrix = mat4.create();

	private rotateDelta = {
		x: Infinity,
		y: Infinity,
	};
	private rotateStart = {
		x: Infinity,
		y: Infinity,
	};
	private rotateEnd = {
		x: Infinity,
		y: Infinity,
	};
	private spherical = {
		radius: 0,
		theta: 0,
		phi: 0,
	};

	private targetXDampedAction = new DampedAction();
	private targetYDampedAction = new DampedAction();
	private targetZDampedAction = new DampedAction();
	private targetThetaDampedAction = new DampedAction();
	private targetPhiDampedAction = new DampedAction();
	private targetRadiusDampedAction = new DampedAction();

	constructor(
		private domElement: HTMLElement,
		public position: vec3,
		public vfov: number,
		public aspectRatio: number,
	) {
		const dx = position[0];
		const dy = position[1];
		const dz = position[2];
		const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
		const theta = Math.atan2(dx, dz);
		const phi = Math.acos(clamp(dy / radius, -1, 1));
		this.spherical.radius = radius;
		this.spherical.theta = theta;
		this.spherical.phi = phi;

		this.domElement.addEventListener("mousedown", this.onMouseDown);
		this.domElement.addEventListener("mouseup", this.onMouseUp);
		this.domElement.addEventListener("wheel", this.onMouseWheel);
	}

	public tick() {
		this.updateDampedAction();
		this.updateCamera();
	}

	private onMouseDown = (e: MouseEvent) => {
		this.rotateStart.x = e.pageX;
		this.rotateStart.y = e.pageY;

		this.domElement.addEventListener("mousemove", this.onMouseMove);
	};

	private onMouseMove = (e: MouseEvent) => {
		this.rotateEnd.x = e.pageX;
		this.rotateEnd.y = e.pageY;

		this.rotateDelta.x = this.rotateEnd.x - this.rotateStart.x;
		this.rotateDelta.y = this.rotateEnd.y - this.rotateStart.y;

		this.targetThetaDampedAction.addForce(-this.rotateDelta.x / innerWidth);
		this.targetPhiDampedAction.addForce(-this.rotateDelta.y / innerHeight);

		this.rotateStart.x = this.rotateEnd.x;
		this.rotateStart.y = this.rotateEnd.y;
	};

	private onMouseUp = (e: MouseEvent) => {
		this.domElement.removeEventListener("mousemove", this.onMouseMove);
	};

	private onMouseWheel = (e: WheelEvent) => {
		const force = 0.1;
		if (e.deltaY > 0) {
			this.targetRadiusDampedAction.addForce(force);
		} else {
			this.targetRadiusDampedAction.addForce(-force);
		}
	};

	private updateDampedAction() {
		this.target[0] += this.targetXDampedAction.update();
		this.target[1] += this.targetYDampedAction.update();
		this.target[2] += this.targetZDampedAction.update();

		this.spherical.theta += this.targetThetaDampedAction.update();
		this.spherical.phi += this.targetPhiDampedAction.update();
		this.spherical.radius += this.targetRadiusDampedAction.update();
	}

	private updateCamera() {
		const s = this.spherical;
		const sinPhiRadius = Math.sin(s.phi) * s.radius;
		this.position[0] = sinPhiRadius * Math.sin(s.theta) + this.target[0];
		this.position[1] = Math.cos(s.phi) * s.radius + this.target[1];
		this.position[2] = sinPhiRadius * Math.cos(s.theta) + this.target[2];

		mat4.lookAt(this.viewMatrix, this.position, this.target, Camera.UP);
		mat4.perspective(this.projectionMatrix, 45, this.aspectRatio, 0.1, 100);
		mat4.mul(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
	}
}
