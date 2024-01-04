import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  fn lengthSquared(vec: vec3f) -> f32 {
    return vec.x * vec.x + vec.y * vec.y + vec.z * vec.z;
  }

  fn randomVec3() -> vec3f {
    return vec3f(rand(), rand(), rand());
  }
  
  fn randomVec3InRange(min: f32, max: f32) -> vec3f {
    return vec3f(randInRange(min, max), randInRange(min, max), randInRange(min, max));
  }
  
  fn randomVec3InUnitSphere() -> vec3f {
    var out: vec3f;
    while(true) {
      let v = randomVec3InRange(-1, 1);
      if (lengthSquared(v) < 1) {
        out = v;
        break;
      }
    }
    return out;
  }

  fn randomUnitVec3() -> vec3f {
    return normalize(randomVec3InUnitSphere());
  }
  
  fn randomUnitVec3OnHemisphere(normal: vec3f) -> vec3f {
    let onUnitSphere = randomUnitVec3();
    return select(-onUnitSphere, onUnitSphere, dot(onUnitSphere, normal) > 0.0);
  }
`;
