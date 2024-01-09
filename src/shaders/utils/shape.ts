import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct Face {
    p0: vec3f, // 0
    p1: vec3f, // 4
    p2: vec3f, // 8

    n0: vec3f, // 12
    n1: vec3f, // 16
    n2: vec3f, // 20

    faceNormal: vec3f // 24
  }

  struct AABB {
    min: vec3f,
    max: vec3f,
    leftChildIdx: i32,
    rightChildIdx: i32,
    faceIdx0: i32,
    faceIdx1: i32
  }

  struct Sphere {
    center: vec3f,
    radius: f32,
    materialIdx: u32,
  };
`;
