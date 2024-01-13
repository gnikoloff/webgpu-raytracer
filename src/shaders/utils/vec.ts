import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  @must_use
  fn randomVec3(rngState: ptr<function, u32>) -> vec3f {
    return vec3f(rngNextFloat(rngState), rngNextFloat(rngState), rngNextFloat(rngState));
  }
  
  @must_use
  fn randomVec3InRange(min: f32, max: f32, rngState: ptr<function, u32>) -> vec3f {
    return vec3f(
      randInRange(min, max, rngState),
      randInRange(min, max, rngState),
      randInRange(min, max, rngState)
    );
  }
  
  fn randomVec3InUnitDisc(state: ptr<function, u32>) -> vec3<f32> {
    let r = sqrt(rngNextFloat(state));
    let alpha = 2f * pi * rngNextFloat(state);

    let x = r * cos(alpha);
    let y = r * sin(alpha);

    return vec3(x, y, 0f);
  }

  fn randomVec3InUnitSphere(state: ptr<function, u32>) -> vec3<f32> {
    let r = pow(rngNextFloat(state), 0.33333f);
    let theta = pi * rngNextFloat(state);
    let phi = 2f * pi * rngNextFloat(state);

    let x = r * sin(theta) * cos(phi);
    let y = r * sin(theta) * sin(phi);
    let z = r * cos(theta);

    return vec3(x, y, z);
  }
  
  @must_use
  fn randomUnitVec3(rngState: ptr<function, u32>) -> vec3f {
    return normalize(randomVec3InUnitSphere(rngState));
  }
  
  @must_use
  fn randomUnitVec3OnHemisphere(normal: vec3f, rngState: ptr<function, u32>) -> vec3f {
    let onUnitSphere = randomUnitVec3(rngState);
    return select(-onUnitSphere, onUnitSphere, dot(onUnitSphere, normal) > 0.0);
  }

  @must_use
  fn nearZero(v: vec3f) -> bool {
    let epsilon = vec3f(1e-8);
    return any(abs(v) < epsilon);
  }
`;
