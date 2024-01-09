import {
	getSizeAndAlignmentOfUnsizedArrayElement,
	makeShaderDataDefinitions,
	makeStructuredView,
} from "webgpu-utils";
import wavefrontObjParser from "obj-file-parser";
import { vec3, vec4 } from "gl-matrix";

import FaceShaderChunk from "./shaders/utils/shape";
import { Face } from "./interfaces";
import { BV } from "./BV";

interface Model {
	faces: Face[];
	AABBs: BV[];
}

export class Scene {
	public static FACES_COUNT = 0;
	public static AABBS_COUNT = 0;

	public static loadObjFileContents = async (fileUrl: string) => {
		const response = await fetch(fileUrl);
		const fileContents = await response.text();
		const objParser = new wavefrontObjParser(fileContents);
		const obj = objParser.parse();

		let posArray: { x: number; y: number; z: number }[] = [];
		let nrmArray: { x: number; y: number; z: number }[] = [];

		const fn = vec3.create();
		const p1p0Diff = vec3.create();
		const p2p0Diff = vec3.create();

		const parsedObjects: Model[] = obj.models.map(
			({ vertices, vertexNormals, faces }) => {
				const posArray = vertices;
				const nrmArray = vertexNormals;

				const outFaces: Face[] = [];
				for (const f of faces) {
					const i0 = f.vertices[0].vertexIndex - 1;
					const i1 = f.vertices[1].vertexIndex - 1;
					const i2 = f.vertices[2].vertexIndex - 1;
					const a = 0;
					const p0 = vec3.fromValues(
						posArray[i0].x,
						posArray[i0].y + a,
						posArray[i0].z,
					);
					const p1 = vec3.fromValues(
						posArray[i1].x,
						posArray[i1].y + a,
						posArray[i1].z,
					);
					const p2 = vec3.fromValues(
						posArray[i2].x,
						posArray[i2].y + a,
						posArray[i2].z,
					);

					const j0 = f.vertices[0].vertexNormalIndex - 1;
					const j1 = f.vertices[1].vertexNormalIndex - 1;
					const j2 = f.vertices[2].vertexNormalIndex - 1;

					const n0 = vec3.fromValues(
						0, //nrmArray[j0].x,
						0, //nrmArray[j0].y,
						0, //nrmArray[j0].z,
					);
					const n1 = vec3.fromValues(
						0, //nrmArray[j1].x,
						0, //nrmArray[j1].y,
						0, //nrmArray[j1].z,
					);
					const n2 = vec3.fromValues(
						0, //nrmArray[j2].x,
						0, //nrmArray[j2].y,
						0, //nrmArray[j2].z,
					);

					vec3.sub(p1p0Diff, p1, p0);
					vec3.sub(p2p0Diff, p2, p0);
					vec3.cross(fn, p1p0Diff, p2p0Diff);
					vec3.normalize(fn, fn);
					outFaces.push({
						p0,
						p1,
						p2,
						n0,
						n1,
						n2,
						fn,
						fi: outFaces.length,
					});
				}

				const outAABBs: BV[] = [];
				// find root BV dimensions
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
				for (const face of outFaces) {
					// calculate min/max for root AABB bounding volume
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
				const bv = new BV(min, max);

				outAABBs.push(bv);
				bv.subdivide(outFaces, outAABBs);
				return {
					faces: outFaces,
					AABBs: outAABBs,
				};
			},
		);

		return parsedObjects;
	};

	public facesBuffer!: GPUBuffer;
	public aabbsBuffer!: GPUBuffer;

	constructor(private device: GPUDevice) {}

	public async loadModels() {
		const shapeShaderDefs = makeShaderDataDefinitions(FaceShaderChunk);
		const shapeStorageValue = makeStructuredView(shapeShaderDefs.structs.Face);

		const suzanneModels = await Scene.loadObjFileContents("teapot.obj");

		// Prepare faces buffer
		this.facesBuffer = this.device.createBuffer({
			size:
				shapeStorageValue.arrayBuffer.byteLength *
				suzanneModels[0].faces.length,
			usage: GPUBufferUsage.STORAGE,
			mappedAtCreation: true,
		});
		const faceData = new Float32Array(this.facesBuffer.getMappedRange());

		Scene.FACES_COUNT = suzanneModels[0].faces.length;

		const numFloatsPerFace = 28;

		// for (let n = 0; n < suzanneModels.length; n++) {
		const suzanneFaces = suzanneModels[0].faces;
		for (let i = 0; i < suzanneFaces.length; i++) {
			const idx = i * numFloatsPerFace;
			const face = suzanneFaces[i];

			faceData[idx + 0] = face.p0[0];
			faceData[idx + 1] = face.p0[1];
			faceData[idx + 2] = face.p0[2];
			// idx + 3 padding
			faceData[idx + 4] = face.p1[0];
			faceData[idx + 5] = face.p1[1];
			faceData[idx + 6] = face.p1[2];
			// idx + 7 padding
			faceData[idx + 8] = face.p2[0];
			faceData[idx + 9] = face.p2[1];
			faceData[idx + 10] = face.p2[2];
			// idx + 11 padding
			faceData[idx + 12] = face.n0[0];
			faceData[idx + 13] = face.n0[1];
			faceData[idx + 14] = face.n0[2];
			// idx + 15 padding
			faceData[idx + 16] = face.n1[0];
			faceData[idx + 17] = face.n1[1];
			faceData[idx + 18] = face.n1[2];
			// idx + 19 padding
			faceData[idx + 20] = face.n2[0];
			faceData[idx + 21] = face.n2[1];
			faceData[idx + 22] = face.n2[2];
			// idx + 23 padding
			faceData[idx + 24] = face.fn[0];
			faceData[idx + 25] = face.fn[1];
			faceData[idx + 26] = face.fn[2];
			// idx + 27 padding
		}
		// }

		this.facesBuffer.unmap();

		// Prepare AABBS buffer
		Scene.AABBS_COUNT = suzanneModels[0].AABBs.length;

		this.aabbsBuffer = this.device.createBuffer({
			size: 12 * Float32Array.BYTES_PER_ELEMENT * Scene.AABBS_COUNT,
			usage: GPUBufferUsage.STORAGE,
			mappedAtCreation: true,
		});
		this.aabbsBuffer.label = "AABB Buffer";

		const aabbArrBuffer = this.aabbsBuffer.getMappedRange();
		const aabbPosData = new Float32Array(aabbArrBuffer);
		const aabbIdxData = new Int32Array(aabbArrBuffer);

		for (let i = 0; i < suzanneModels[0].AABBs.length; i++) {
			const aabb = suzanneModels[0].AABBs[i];
			aabbPosData[i * 12 + 0] = aabb.min[0];
			aabbPosData[i * 12 + 1] = aabb.min[1];
			aabbPosData[i * 12 + 2] = aabb.min[2];
			aabbPosData[i * 12 + 3] = 1;
			aabbPosData[i * 12 + 4] = aabb.max[0];
			aabbPosData[i * 12 + 5] = aabb.max[1];
			aabbPosData[i * 12 + 6] = aabb.max[2];

			aabbIdxData[i * 12 + 7] = aabb.lt;
			aabbIdxData[i * 12 + 8] = aabb.rt;
			aabbIdxData[i * 12 + 9] = aabb.fi[0];
			aabbIdxData[i * 12 + 10] = aabb.fi[1];
			aabbIdxData[i * 12 + 11] = 999;
			console.log(aabb.fi[0], aabb.fi[1]);
		}

		this.aabbsBuffer.unmap();
	}
}
