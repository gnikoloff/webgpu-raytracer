import { vec4 } from "gl-matrix";
import { Face } from "./interfaces";

type Axis = 0 | 1 | 2;

export class BV {
	public static readonly BV_MIN_DELTA = 0.01;

	private static readonly X_AXIS: Axis = 0;
	private static readonly Y_AXIS: Axis = 1;
	private static readonly Z_AXIS: Axis = 2;

	public lt: number; // left child BV index
	public rt: number; // right child BV index
	public fi: number[]; // face indices

	constructor(public min: vec4, public max: vec4) {
		this.lt = -1;
		this.rt = -1;
		this.fi = [-1, -1];
	}

	public subdivide(faces: Face[], AABBs: BV[]) {
		if (faces.length <= this.fi.length) {
			for (let i = 0; i < faces.length; i++) {
				this.fi[i] = faces[i].fi;
			}
		} else {
			const dx = Math.abs(this.max[0] - this.min[0]);
			const dy = Math.abs(this.max[1] - this.min[1]);
			const dz = Math.abs(this.max[2] - this.min[2]);
			const largestDelta = Math.max(dx, dy, dz);
			if (largestDelta === dx) {
				this.splitAcross(BV.X_AXIS, faces, AABBs);
			} else if (largestDelta === dy) {
				this.splitAcross(BV.Y_AXIS, faces, AABBs);
			} else {
				this.splitAcross(BV.Z_AXIS, faces, AABBs);
			}
		}
	}

	private splitAcross(axis: Axis, faces: Face[], AABBs: BV[]) {
		const sorted = [...faces].sort((faceA, faceB) => {
			const a0 = faceA.p0[axis];
			const a1 = faceA.p1[axis];
			const a2 = faceA.p2[axis];

			const b0 = faceB.p0[axis];
			const b1 = faceB.p1[axis];
			const b2 = faceB.p2[axis];

			return (a0 + a1 + a2) / 3 - (b0 + b1 + b2) / 3;
		});

		const h = sorted.length / 2;
		const l = sorted.length;
		const ltFaces = sorted.slice(0, h); // left faces
		const rtFaces = sorted.slice(h, l); // right faces
		let ltBV: BV;
		let rtBV: BV;

		if (ltFaces.length) {
			const min = vec4.fromValues(
				Number.MAX_SAFE_INTEGER,
				Number.MAX_SAFE_INTEGER,
				Number.MAX_SAFE_INTEGER,
				1,
			);
			const max = vec4.fromValues(
				Number.MIN_SAFE_INTEGER,
				Number.MIN_SAFE_INTEGER,
				Number.MIN_SAFE_INTEGER,
				1,
			);
			for (const face of ltFaces) {
				min[0] = Math.min(min[0], face.p0[0], face.p1[0], face.p2[0]);
				min[1] = Math.min(min[1], face.p0[1], face.p1[1], face.p2[1]);
				min[2] = Math.min(min[2], face.p0[2], face.p1[2], face.p2[2]);
				max[0] = Math.max(max[0], face.p0[0], face.p1[0], face.p2[0]);
				max[1] = Math.max(max[1], face.p0[1], face.p1[1], face.p2[1]);
				max[2] = Math.max(max[2], face.p0[2], face.p1[2], face.p2[2]);
			}
			if (max[0] - min[0] < BV.BV_MIN_DELTA) {
				max[0] += BV.BV_MIN_DELTA;
			}
			if (max[1] - min[1] < BV.BV_MIN_DELTA) {
				max[1] += BV.BV_MIN_DELTA;
			}
			if (max[2] - min[2] < BV.BV_MIN_DELTA) {
				max[2] += BV.BV_MIN_DELTA;
			}
			this.lt = AABBs.length;
			ltBV = new BV(min, max);
			AABBs.push(ltBV);
		}

		if (rtFaces.length) {
			const min = vec4.fromValues(
				Number.MAX_SAFE_INTEGER,
				Number.MAX_SAFE_INTEGER,
				Number.MAX_SAFE_INTEGER,
				1,
			);
			const max = vec4.fromValues(
				Number.MIN_SAFE_INTEGER,
				Number.MIN_SAFE_INTEGER,
				Number.MIN_SAFE_INTEGER,
				1,
			);
			for (const face of rtFaces) {
				min[0] = Math.min(min[0], face.p0[0], face.p1[0], face.p2[0]);
				min[1] = Math.min(min[1], face.p0[1], face.p1[1], face.p2[1]);
				min[2] = Math.min(min[2], face.p0[2], face.p1[2], face.p2[2]);
				max[0] = Math.max(max[0], face.p0[0], face.p1[0], face.p2[0]);
				max[1] = Math.max(max[1], face.p0[1], face.p1[1], face.p2[1]);
				max[2] = Math.max(max[2], face.p0[2], face.p1[2], face.p2[2]);
			}
			if (max[0] - min[0] < BV.BV_MIN_DELTA) {
				max[0] += BV.BV_MIN_DELTA;
			}
			if (max[1] - min[1] < BV.BV_MIN_DELTA) {
				max[1] += BV.BV_MIN_DELTA;
			}
			if (max[2] - min[2] < BV.BV_MIN_DELTA) {
				max[2] += BV.BV_MIN_DELTA;
			}

			this.rt = AABBs.length;
			rtBV = new BV(min, max);
			AABBs.push(rtBV);
		}

		if (ltBV) {
			ltBV.subdivide(ltFaces, AABBs);
		}

		if (rtBV) {
			rtBV.subdivide(rtFaces, AABBs);
		}
	}
}
