import { vec4 } from "gl-matrix";

type MaterialType = 0 | 1 | 2 | 3;

export class Material {
	public static readonly EMISSIVE_MATERIAL: MaterialType = 0;
	public static readonly REFLECTIVE_MATERIAL: MaterialType = 1;
	public static readonly DIELECTRIC_MATERIAL: MaterialType = 2;
	public static readonly LAMBERTIAN_MATERIAL: MaterialType = 3;

	constructor(
		public albedo: vec4,
		public mtlType: MaterialType = Material.LAMBERTIAN_MATERIAL,
		public reflectionRatio = 0,
		public reflectionGloss = 1,
		public refractionIndex = 1,
	) {}
}
