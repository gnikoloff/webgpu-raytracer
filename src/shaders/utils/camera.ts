import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct Camera {
    viewportSize: vec2u,
    imageWidth: f32,
    imageHeight: f32,
    pixel00Loc: vec3<f32>,
    pixelDeltaU: vec3<f32>,
    pixelDeltaV: vec3<f32>,

    aspectRatio: f32,
    center: vec3<f32>,
    vfov: f32,

    lookFrom: vec3f,
    lookAt: vec3f,
    vup: vec3f,

    defocusAngle: f32,
    focusDist: f32,

    defocusDiscU: vec3f,
    defocusDiscV: vec3f
  }
`;
