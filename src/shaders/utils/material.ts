import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct Material {
    materialType: u32,
    reflectionRatio: f32,
    reflectionGloss: f32,
    refractionIndex: f32,
    albedo: vec3f,
  };

  @must_use
  fn scatterLambertian(
    material: ptr<function, Material>,
    ray: ptr<function, Ray>,
    scattered: ptr<function, Ray>,
    hitRec: ptr<function, HitRecord>,
    attenuation: ptr<function, vec3f>,
    rngState: ptr<function, u32>
  ) -> bool {
    var scatterDirection = (*hitRec).normal + randomUnitVec3(rngState);
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
    attenuation: ptr<function, vec3f>,
    rngState: ptr<function, u32>
  ) -> bool {
    let reflected = reflect(normalize((*ray).direction), (*hitRec).normal);
    (*scattered) = Ray((*hitRec).p, reflected + (*material).reflectionGloss * randomUnitVec3(rngState));
    (*attenuation) = (*material).albedo;
    return (dot((*scattered).direction, (*hitRec).normal) >= 0);
  }

  @must_use
  fn scatterDielectric(
    material: ptr<function, Material>,
    ray: ptr<function, Ray>,
    scattered: ptr<function, Ray>,
    hitRec: ptr<function, HitRecord>,
    attenuation: ptr<function, vec3f>,
    rngState: ptr<function, u32>
  ) -> bool {
    *attenuation = vec3f(1);
    let refractRatio = select((*material).refractionIndex, 1.0 / (*material).refractionIndex, (*hitRec).frontFace);
    let unitDirection = normalize((*ray).direction);
    let cosTheta = dot(-unitDirection, (*hitRec).normal);
    let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    let cannotRefract = refractRatio * sinTheta > 1.0;
    let direction = select(
      refract(unitDirection, (*hitRec).normal, refractRatio),
      reflect(unitDirection, (*hitRec).normal),
      cannotRefract || reflectance(cosTheta, refractRatio) > rngNextFloat(rngState)
    );
    (*scattered) = Ray((*hitRec).p, direction);
    return true;
  }

  @must_use
  fn reflectance(cosine: f32, refractionIndex: f32) -> f32 {
    // Use Schlick's approximation for reflectance.
    var r0 = (1.0 - refractionIndex) / (1.0 + refractionIndex);
    r0 *= r0;
    return r0 + (1.0 - r0) * pow((1.0 - cosine), 5.0);
  }

`;
