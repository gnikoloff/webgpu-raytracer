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

type CameraState = "rotate" | "pan";

export class Camera {
	public static readonly UP = vec3.fromValues(0, 1, 0);

	public target = vec3.fromValues(0, 0, -1);
	public viewProjectionMatrix = mat4.create();
	public viewMatrix = mat4.create();
	public projectionMatrix = mat4.create();

	public viewportWidth = innerWidth;
	public viewportHeight = innerHeight;

	private state: CameraState = "rotate";

	private fov = 45; // degrees

	// Mouse/touch tracking
	private rotateDelta = { x: 0, y: 0 };
	private rotateStart = { x: 0, y: 0 };
	private rotateEnd = { x: 0, y: 0 };
	private panStart = { x: 0, y: 0 };
	private panDelta = { x: 0, y: 0 };
	private panEnd = { x: 0, y: 0 };

	// Touch dolly tracking
	private touchStartDistance = 0;
	private touchEndDistance = 0;

	// Spherical coordinates (relative to target)
	private spherical = {
		radius: 0,
		theta: 0,
		phi: 0,
	};

	// Constraints
	private minDistance = 0.1;
	private maxDistance = 100;
	private minPolarAngle = 0; // radians
	private maxPolarAngle = Math.PI; // radians

	// Damped actions
	private targetXDampedAction = new DampedAction();
	private targetYDampedAction = new DampedAction();
	private targetZDampedAction = new DampedAction();
	private targetThetaDampedAction = new DampedAction();
	private targetPhiDampedAction = new DampedAction();
	private targetRadiusDampedAction = new DampedAction();

	// Sensitivity settings
	private rotateSpeed = 1.0;
	private panSpeed = 0.5;
	private zoomSpeed = 2.0;

	constructor(
		private domElement: HTMLElement,
		public position: vec3,
		public vfov: number,
		public aspectRatio: number,
	) {
		// Initialize spherical coordinates based on initial position relative to target
		this.updateSphericalFromPosition();

		// Event listeners
		this.domElement.addEventListener("touchstart", this.onTouchStart);
		this.domElement.addEventListener("touchend", this.onTouchEnd);
		this.domElement.addEventListener("mousedown", this.onMouseDown);
		this.domElement.addEventListener("mouseup", this.onMouseUp);
		this.domElement.addEventListener("wheel", this.onMouseWheel, {
			passive: true,
		});
		this.domElement.addEventListener("contextmenu", this.onContextMenu);
		window.addEventListener("resize", this.onResize);
	}

	private updateSphericalFromPosition() {
		const offset = vec3.create();
		vec3.subtract(offset, this.position, this.target);

		const radius = vec3.length(offset);
		const theta = Math.atan2(offset[0], offset[2]);
		const phi = Math.acos(clamp(offset[1] / radius, -1, 1));

		this.spherical.radius = radius;
		this.spherical.theta = theta;
		this.spherical.phi = phi;
	}

	public tick() {
		this.updateDampedAction();
		this.updateCamera();
	}

	private onResize = () => {
		this.viewportWidth = innerWidth;
		this.viewportHeight = innerHeight;
		this.aspectRatio = this.viewportWidth / this.viewportHeight;
	};

	private onTouchStart = (e: TouchEvent) => {
		e.preventDefault();

		if (e.touches.length === 1) {
			this.state = "rotate";
			this.rotateStart.x = e.touches[0].pageX;
			this.rotateStart.y = e.touches[0].pageY;
		} else if (e.touches.length === 2) {
			// Two finger touch - check if we should pan or dolly based on initial gesture
			const touch1 = e.touches[0];
			const touch2 = e.touches[1];

			// Calculate initial distance between touches for dollying
			this.touchStartDistance = Math.sqrt(
				Math.pow(touch2.pageX - touch1.pageX, 2) +
					Math.pow(touch2.pageY - touch1.pageY, 2),
			);

			// Use first touch for pan reference
			this.panStart.x = touch1.pageX;
			this.panStart.y = touch1.pageY;
		}

		this.domElement.addEventListener("touchmove", this.onTouchMove);
	};

	private onTouchEnd = (e: TouchEvent) => {
		e.preventDefault();
		this.domElement.removeEventListener("touchmove", this.onTouchMove);
	};

	private onTouchMove = (e: TouchEvent) => {
		e.preventDefault();

		if (e.touches.length === 1 && this.state === "rotate") {
			// Single touch rotation
			this.rotateEnd.x = e.touches[0].pageX;
			this.rotateEnd.y = e.touches[0].pageY;

			this.rotateDelta.x =
				(this.rotateEnd.x - this.rotateStart.x) * this.rotateSpeed;
			this.rotateDelta.y =
				(this.rotateEnd.y - this.rotateStart.y) * this.rotateSpeed;

			// Use damped actions for smoother touch rotation
			this.targetThetaDampedAction.addForce(
				-this.rotateDelta.x / this.viewportWidth,
			);
			this.targetPhiDampedAction.addForce(
				-this.rotateDelta.y / this.viewportHeight,
			);

			this.rotateStart.x = this.rotateEnd.x;
			this.rotateStart.y = this.rotateEnd.y;
		} else if (e.touches.length === 2) {
			// Two finger touch - handle both panning and dollying
			const touch1 = e.touches[0];
			const touch2 = e.touches[1];

			// Calculate current distance between touches
			this.touchEndDistance = Math.sqrt(
				Math.pow(touch2.pageX - touch1.pageX, 2) +
					Math.pow(touch2.pageY - touch1.pageY, 2),
			);

			// Dolly based on distance change
			if (this.touchStartDistance > 0) {
				const dollyDelta =
					(this.touchEndDistance - this.touchStartDistance) /
					this.viewportHeight;
				this.targetRadiusDampedAction.addForce(
					-dollyDelta * this.zoomSpeed * 3,
				);
				this.touchStartDistance = this.touchEndDistance;
			}

			// Pan based on midpoint movement
			const currentMidX = (touch1.pageX + touch2.pageX) / 2;
			const currentMidY = (touch1.pageY + touch2.pageY) / 2;

			this.panDelta.x = (currentMidX - this.panStart.x) * this.panSpeed;
			this.panDelta.y = (currentMidY - this.panStart.y) * this.panSpeed;

			if (Math.abs(this.panDelta.x) > 1 || Math.abs(this.panDelta.y) > 1) {
				this.pan(this.panDelta.x, this.panDelta.y);
			}

			this.panStart.x = currentMidX;
			this.panStart.y = currentMidY;
		}
	};

	private onMouseDown = (e: MouseEvent) => {
		if (e.button === 0) {
			// Left click
			this.state = "rotate";
			this.rotateStart.x = e.pageX;
			this.rotateStart.y = e.pageY;
		} else if (e.button === 2) {
			// Right click
			this.state = "pan";
			this.panStart.x = e.pageX;
			this.panStart.y = e.pageY;
		}
		this.domElement.addEventListener("mousemove", this.onMouseMove);
	};

	private onMouseMove = (e: MouseEvent) => {
		if (this.state === "rotate") {
			this.rotateEnd.x = e.pageX;
			this.rotateEnd.y = e.pageY;

			this.rotateDelta.x =
				(this.rotateEnd.x - this.rotateStart.x) * this.rotateSpeed;
			this.rotateDelta.y =
				(this.rotateEnd.y - this.rotateStart.y) * this.rotateSpeed;

			// Apply rotation around target using damped actions
			this.targetThetaDampedAction.addForce(
				-this.rotateDelta.x / this.viewportWidth,
			);
			this.targetPhiDampedAction.addForce(
				-this.rotateDelta.y / this.viewportHeight,
			);

			this.rotateStart.x = this.rotateEnd.x;
			this.rotateStart.y = this.rotateEnd.y;
		} else if (this.state === "pan") {
			this.panEnd.x = e.pageX;
			this.panEnd.y = e.pageY;

			this.panDelta.x = (this.panEnd.x - this.panStart.x) * this.panSpeed;
			this.panDelta.y = (this.panEnd.y - this.panStart.y) * this.panSpeed;

			this.pan(this.panDelta.x, this.panDelta.y);

			this.panStart.x = this.panEnd.x;
			this.panStart.y = this.panEnd.y;
		}
	};

	private onMouseUp = (e: MouseEvent) => {
		this.domElement.removeEventListener("mousemove", this.onMouseMove);
	};

	private onMouseWheel = (e: WheelEvent) => {
		const force = e.deltaY > 0 ? this.zoomSpeed * 0.1 : -this.zoomSpeed * 0.1;
		this.targetRadiusDampedAction.addForce(force);
	};

	private onContextMenu = (e: PointerEvent) => {
		e.preventDefault();
	};

	private updateDampedAction() {
		// Update target position (for panning)
		this.target[0] += this.targetXDampedAction.update();
		this.target[1] += this.targetYDampedAction.update();
		this.target[2] += this.targetZDampedAction.update();

		// Update spherical coordinates (for rotation around target)
		this.spherical.theta += this.targetThetaDampedAction.update();
		this.spherical.phi += this.targetPhiDampedAction.update();
		this.spherical.radius += this.targetRadiusDampedAction.update();

		// Apply constraints
		this.spherical.radius = clamp(
			this.spherical.radius,
			this.minDistance,
			this.maxDistance,
		);
		this.spherical.phi = clamp(
			this.spherical.phi,
			this.minPolarAngle,
			this.maxPolarAngle,
		);
	}

	private updateCamera() {
		// Convert spherical coordinates to Cartesian position relative to target
		const s = this.spherical;
		const sinPhiRadius = Math.sin(s.phi) * s.radius;

		this.position[0] = sinPhiRadius * Math.sin(s.theta) + this.target[0];
		this.position[1] = Math.cos(s.phi) * s.radius + this.target[1];
		this.position[2] = sinPhiRadius * Math.cos(s.theta) + this.target[2];

		// Update matrices
		mat4.lookAt(this.viewMatrix, this.position, this.target, Camera.UP);
		mat4.perspective(
			this.projectionMatrix,
			// (this.fov * Math.PI) / 180, // Convert degrees to radians
			this.fov,
			this.aspectRatio,
			0.1,
			100,
		);
		mat4.mul(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
	}

	private pan(dx: number, dy: number) {
		// Calculate pan distance based on camera distance and field of view
		const targetDistance = vec3.distance(this.position, this.target);
		const fovRadians = (this.fov * Math.PI) / 180;
		const scale =
			(2 * targetDistance * Math.tan(fovRadians * 0.5)) / this.viewportHeight;

		// Extract camera's right and up vectors from view matrix
		const rightVector = vec3.fromValues(
			this.viewMatrix[0], // m00
			this.viewMatrix[4], // m10
			this.viewMatrix[8], // m20
		);

		const upVector = vec3.fromValues(
			this.viewMatrix[1], // m01
			this.viewMatrix[5], // m11
			this.viewMatrix[9], // m21
		);

		// Calculate pan offset
		const panOffset = vec3.create();
		vec3.scale(rightVector, rightVector, -dx * scale);
		vec3.scale(upVector, upVector, dy * scale);
		vec3.add(panOffset, rightVector, upVector);

		// Apply pan to target using damped actions for smooth movement
		this.targetXDampedAction.addForce(panOffset[0]);
		this.targetYDampedAction.addForce(panOffset[1]);
		this.targetZDampedAction.addForce(panOffset[2]);
	}

	// Public methods for programmatic control
	public setTarget(x: number, y: number, z: number) {
		vec3.set(this.target, x, y, z);
	}

	public setPosition(x: number, y: number, z: number) {
		vec3.set(this.position, x, y, z);
		this.updateSphericalFromPosition();
	}

	public setDistance(distance: number) {
		this.spherical.radius = clamp(distance, this.minDistance, this.maxDistance);
	}

	public getDistance(): number {
		return this.spherical.radius;
	}

	public setConstraints(
		minDistance: number,
		maxDistance: number,
		minPolarAngle?: number,
		maxPolarAngle?: number,
	) {
		this.minDistance = minDistance;
		this.maxDistance = maxDistance;
		if (minPolarAngle !== undefined) this.minPolarAngle = minPolarAngle;
		if (maxPolarAngle !== undefined) this.maxPolarAngle = maxPolarAngle;
	}
}
