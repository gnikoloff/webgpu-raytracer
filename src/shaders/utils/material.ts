import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  const MATERIAL_LAMBERTIAN = 0;
  const MATERIAL_METAL = 1;
  const MATERIAL_DIELECTRIC = 2;

  struct Material {
    materialType: u32,
    albedo: vec3f,
    fuzz: f32,
    ior: f32,
  };

  @must_use
  fn makeLambertianMaterial(albedo: vec3f) -> Material {
    return Material(MATERIAL_LAMBERTIAN, albedo, 0, 0);
  }

  @must_use
  fn makeMetalMaterial(albedo: vec3f, fuzz: f32) -> Material {
    return Material(MATERIAL_METAL, albedo, fuzz, 0);
  }

  @must_use
  fn makeDielectricMaterial(ior: f32) -> Material {
    return Material(MATERIAL_DIELECTRIC, vec3f(1), 0, ior);
  }

  @must_use
  fn scatterLambertian(
    material: ptr<function, Material>,
    ray: ptr<function, Ray>,
    scattered: ptr<function, Ray>,
    hitRec: ptr<function, HitRecord>,
    attenuation: ptr<function, vec3f>
  ) -> bool {
    var scatterDirection = (*hitRec).normal + randomUnitVec3();
    if (nearZero(scatterDirection)) {
      scatterDirection = (*hitRec).normal;
    }
    (*scattered) = Ray((*hitRec).p, scatterDirection);
    (*attenuation) = (*material).albedo;
    return true;
  }

  @must_use
  fn scatterMetal(
    material: ptr<function, Material>,
    ray: ptr<function, Ray>,
    scattered: ptr<function, Ray>,
    hitRec: ptr<function, HitRecord>,
    attenuation: ptr<function, vec3f>
  ) -> bool {
    let reflected = reflect(normalize((*ray).direction), (*hitRec).normal);
    (*scattered) = Ray((*hitRec).p, reflected + (*material).fuzz * randomUnitVec3());
    (*attenuation) = (*material).albedo;
    return (dot((*scattered).direction, (*hitRec).normal) >= 0);
  }

  @must_use
  fn scatterDielectric(
    material: ptr<function, Material>,
    ray: ptr<function, Ray>,
    scattered: ptr<function, Ray>,
    hitRec: ptr<function, HitRecord>,
    attenuation: ptr<function, vec3f>
  ) -> bool {
    *attenuation = vec3f(1);
    let refractRatio = select((*material).ior, 1.0 / (*material).ior, (*hitRec).frontFace);
    let unitDirection = normalize((*ray).direction);
    let cosTheta = min(dot(-unitDirection, (*hitRec).normal), 1.0);
    let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    let cannotRefract = refractRatio * sinTheta > 1.0;
    let direction = select(
      refract(unitDirection, (*hitRec).normal, refractRatio),
      reflect(unitDirection, (*hitRec).normal),
      cannotRefract || reflectance(cosTheta, refractRatio) > rand()
    );
    (*scattered) = Ray((*hitRec).p, direction);
    return true;
  }

  @must_use
  fn reflectance(cosine: f32, refIdx: f32) -> f32 {
    // Use Schlick's approximation for reflectance.
    var r0 = (1 - refIdx) / (1 + refIdx);
    r0 = r0 * r0;
    return r0 + (1 - r0) * pow((1 - cosine), 5);
  }

`;
