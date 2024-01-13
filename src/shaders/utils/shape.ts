import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct Face {
    p0: vec3f,
    p1: vec3f,
    p2: vec3f,

    n0: vec3f,
    n1: vec3f,
    n2: vec3f,

    faceNormal: vec3f,
    materialIdx: u32
  }

  struct AABB {
    min: vec3f,
    max: vec3f,
    leftChildIdx: i32,
    rightChildIdx: i32,
    faceIdx0: i32,
    faceIdx1: i32
  }

  struct Mesh {
    aabbOffset: i32,
    faceOffset: i32
  }

  struct Sphere {
    center: vec3f,
    radius: f32,
    materialIdx: u32,
  }
`;
