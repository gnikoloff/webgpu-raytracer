import wavefrontObjParser from "obj-file-parser";
import wavefrontMtlParser from "mtl-file-parser";
import { vec3, vec4 } from "gl-matrix";

import { BV } from "./BV";
import { Material } from "./Material";

interface Model {
	name: string;
	vertices: { x: number; y: number; z: number }[];
	vertexNormals: { x: number; y: number; z: number }[];
	faces: {
		material: string;
		vertices: {
			vertexIndex: number;
			textureCoordsIndex: number;
			vertexNormalIndex: number;
		}[];
	}[];
}

interface Mtl {
	name: string;
	Kd: {
		method: string;
		red: number;
		green: number;
		blue: number;
	};
}

export interface Face {
	p0: vec3;
	p1: vec3;
	p2: vec3;

	n0: vec3;
	n1: vec3;
	n2: vec3;

	fn: vec3;
	fi: number; // index into face array
	mi: number; // index into the material
}

interface ParsedModel {
	faces: Face[];
	AABBs: BV[];
}

export class Scene {
	public static AABBS_COUNT = 0;
	public static MODELS_COUNT = 0;
	public static MATERIALS_COUNT = 0;
	public static MAX_NUM_BVs_PER_MESH = 0;
	public static MAX_NUM_FACES_PER_MESH = 0;

	private static loadObjFileContents = async (fileUrl: string) => {
		const response = await fetch(fileUrl);
		const fileContents = await response.text();
		const objParser = new wavefrontObjParser(fileContents);
		return objParser.parse();
	};

	private static loadMtlFileContents = async (fileUrl: string) => {
		const response = await fetch(fileUrl);
		const fileContents = await response.text();
		const mtlParser = new wavefrontMtlParser(fileContents);
		return mtlParser.parse();
	};

	private static parseModel(models: Model[], materials: Mtl[]): ParsedModel[] {
		let posArray: { x: number; y: number; z: number }[] = [];
		let nrmArray: { x: number; y: number; z: number }[] = [];

		console.log(models);

		const fn = vec3.create();
		const p1p0Diff = vec3.create();
		const p2p0Diff = vec3.create();

		return models.map(({ vertices, vertexNormals, faces }, i) => {
			posArray = posArray.concat(vertices);
			nrmArray = nrmArray.concat(vertexNormals);

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
					nrmArray[j0].x,
					nrmArray[j0].y,
					nrmArray[j0].z,
				);
				const n1 = vec3.fromValues(
					nrmArray[j1].x,
					nrmArray[j1].y,
					nrmArray[j1].z,
				);
				const n2 = vec3.fromValues(
					nrmArray[j2].x,
					nrmArray[j2].y,
					nrmArray[j2].z,
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
					fn: vec3.clone(fn),
					fi: outFaces.length,
					mi: materials.findIndex(({ name }) => name === f.material),
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
		});
	}

	private static parseMaterial(materials: Mtl[]): Material[] {
		return materials.map((mtl) => {
			const material = new Material(
				vec4.fromValues(mtl.Kd.red, mtl.Kd.green, mtl.Kd.blue, 1),
			);
			switch (mtl.name) {
				case "Light":
					material.mtlType = Material.EMISSIVE_MATERIAL;
					material.albedo[0] = 6;
					material.albedo[1] = 6;
					material.albedo[2] = 6;
					break;
				case "Dodecahedron":
					material.mtlType = Material.DIELECTRIC_MATERIAL;
					material.refractionIndex = 4.5;
					// 	// material.reflectionRatio = 1;
					// 	// material.reflectionGloss = 0.1;
					break;
				// case "BloodyRed":
				case "Floor":
					material.mtlType = Material.REFLECTIVE_MATERIAL;
					material.reflectionRatio = 1;
					material.reflectionGloss = 0.2;
					break;
				case "Teapot":
					material.mtlType = Material.REFLECTIVE_MATERIAL;
					material.reflectionRatio = 1;
					material.reflectionGloss = 0.4;
					break;
				case "Suzanne":
					// material.mtlType = Material.REFLECTIVE_MATERIAL;
					// material.reflectionRatio = 0.1;
					// material.reflectionGloss = ;
					break;
				default:
					break;
			}

			return material;
		});
	}

	public facesBuffer!: GPUBuffer;
	public aabbsBuffer!: GPUBuffer;
	public materialsBuffer!: GPUBuffer;

	constructor(private device: GPUDevice) {}

	public async loadModels() {
		const [objFileContents, mtlFileContents] = await Promise.all([
			Scene.loadObjFileContents("raytraced-scene.obj"),
			Scene.loadMtlFileContents("raytraced-scene-real.mtl"),
		]);

		const sceneModels = Scene.parseModel(
			objFileContents.models,
			mtlFileContents,
		);
		const sceneMaterials = Scene.parseMaterial(mtlFileContents);

		Scene.MODELS_COUNT = sceneModels.length;

		// Prepare faces buffer
		{
			Scene.MAX_NUM_FACES_PER_MESH = sceneModels.reduce(
				(max, obj) => Math.max(max, obj.faces.length),
				0,
			);
			const numFloatsPerFace = 28;
			this.facesBuffer = this.device.createBuffer({
				size:
					numFloatsPerFace *
					Float32Array.BYTES_PER_ELEMENT *
					Scene.MAX_NUM_FACES_PER_MESH *
					Scene.MODELS_COUNT,
				usage: GPUBufferUsage.STORAGE,
				mappedAtCreation: true,
			});
			this.facesBuffer.label = "Faces Buffer";
			const facesBufferMappedRange = this.facesBuffer.getMappedRange();
			const faceData = new Float32Array(facesBufferMappedRange);
			const faceColorData = new Uint32Array(facesBufferMappedRange);

			for (let i = 0; i < Scene.MODELS_COUNT; i++) {
				const modelFaces = sceneModels[i].faces;
				let idx = i * numFloatsPerFace * Scene.MAX_NUM_FACES_PER_MESH;
				for (const face of modelFaces) {
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

					faceColorData[idx + 27] = face.mi;

					idx += numFloatsPerFace;
				}
			}
			this.facesBuffer.unmap();
		}

		// Prepare AABBS buffer
		{
			Scene.MAX_NUM_BVs_PER_MESH = sceneModels.reduce(
				(val: number, obj) => Math.max(val, obj.AABBs.length),
				0,
			);
			const numFloatsPerBV = 12;

			Scene.AABBS_COUNT = Scene.MAX_NUM_BVs_PER_MESH * Scene.MODELS_COUNT;

			this.aabbsBuffer = this.device.createBuffer({
				size:
					numFloatsPerBV * Float32Array.BYTES_PER_ELEMENT * Scene.AABBS_COUNT,
				usage: GPUBufferUsage.STORAGE,
				mappedAtCreation: true,
			});
			this.aabbsBuffer.label = "AABBs Buffer";

			const aabbArrBuffer = this.aabbsBuffer.getMappedRange();
			const aabbPosData = new Float32Array(aabbArrBuffer);
			const aabbIdxData = new Int32Array(aabbArrBuffer);

			for (let i = 0; i < Scene.MODELS_COUNT; i++) {
				const modelAABBs = sceneModels[i].AABBs;
				let idx = numFloatsPerBV * Scene.MAX_NUM_BVs_PER_MESH * i;
				for (const aabb of modelAABBs) {
					aabbPosData[idx + 0] = aabb.min[0];
					aabbPosData[idx + 1] = aabb.min[1];
					aabbPosData[idx + 2] = aabb.min[2];
					aabbPosData[idx + 3] = 1;
					aabbPosData[idx + 4] = aabb.max[0];
					aabbPosData[idx + 5] = aabb.max[1];
					aabbPosData[idx + 6] = aabb.max[2];
					aabbIdxData[idx + 7] = aabb.lt;
					aabbIdxData[idx + 8] = aabb.rt;
					aabbIdxData[idx + 9] = aabb.fi[0];
					aabbIdxData[idx + 10] = aabb.fi[1];
					aabbIdxData[idx + 11] = 0; // padding
					idx += numFloatsPerBV;
				}
			}
			this.aabbsBuffer.unmap();

			// Prepare materials buffer
			{
				Scene.MATERIALS_COUNT = sceneMaterials.length;
				const numFloatsPerMaterial = 8;
				this.materialsBuffer = this.device.createBuffer({
					size:
						numFloatsPerMaterial *
						Float32Array.BYTES_PER_ELEMENT *
						Scene.MATERIALS_COUNT,
					usage: GPUBufferUsage.STORAGE,
					mappedAtCreation: true,
				});
				this.materialsBuffer.label = "Materials Buffer";

				const materialBufferContents = this.materialsBuffer.getMappedRange();
				const materialsProperties = new Float32Array(materialBufferContents);
				const materialsTypes = new Uint32Array(materialBufferContents);

				for (let i = 0; i < sceneMaterials.length; i++) {
					const mtl = sceneMaterials[i];
					const idx = i * numFloatsPerMaterial;
					materialsTypes[idx + 0] = mtl.mtlType;

					materialsProperties[idx + 1] = mtl.reflectionRatio;
					materialsProperties[idx + 2] = mtl.reflectionGloss;
					materialsProperties[idx + 3] = mtl.refractionIndex;

					materialsProperties[idx + 4] = mtl.albedo[0];
					materialsProperties[idx + 5] = mtl.albedo[1];
					materialsProperties[idx + 6] = mtl.albedo[2];
				}

				this.materialsBuffer.unmap();
			}
		}
	}
}
