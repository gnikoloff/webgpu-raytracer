import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  @must_use
  fn lengthSquared(vec: vec3f) -> f32 {
    return vec.x * vec.x + vec.y * vec.y + vec.z * vec.z;
  }

  @must_use
  fn randomVec3() -> vec3f {
    return vec3f(rand(), rand(), rand());
  }
  
  @must_use
  fn randomVec3InRange(min: f32, max: f32) -> vec3f {
    return vec3f(randInRange(min, max), randInRange(min, max), randInRange(min, max));
  }
  
  @must_use
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

  @must_use
  fn randomVec3InUnitDisc() -> vec3f {
    var out: vec3f;
    while(true) {
      let p = vec3f(randInRange(-1, 1), randInRange(-1, 1), 0);
      if (dot(p, p) < 1) {
        out = p;
        break;
      }
    }
    return out;
  }
  
  @must_use
  fn randomUnitVec3() -> vec3f {
    return normalize(randomVec3InUnitSphere());
  }
  
  @must_use
  fn randomUnitVec3OnHemisphere(normal: vec3f) -> vec3f {
    let onUnitSphere = randomUnitVec3();
    return select(-onUnitSphere, onUnitSphere, dot(onUnitSphere, normal) > 0.0);
  }

  @must_use
  fn nearZero(v: vec3f) -> bool {
    let epsilon = vec3f(1e-8);
    return any(abs(v) < epsilon);
  }
`;
