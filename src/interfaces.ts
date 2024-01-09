import { vec3 } from "gl-matrix";

export interface Face {
	p0: vec3;
	p1: vec3;
	p2: vec3;

	n0: vec3;
	n1: vec3;
	n2: vec3;

	fn: vec3;
	fi: number; // index into face array
}
