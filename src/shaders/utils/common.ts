import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct CommonUniforms {
    // Random seed for the workgroup
    seed : vec3u,
    frameCounter: u32,
    viewportSize: vec2u
  }
`;
