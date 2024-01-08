import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct Ray {
    origin: vec3f,
    direction: vec3f,
  };

  @must_use
  fn rayAt(ray: ptr<function, Ray>, t: f32) -> vec3f {
    return (*ray).origin + (*ray).direction * t;
  }
`;
