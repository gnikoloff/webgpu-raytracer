import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct VertexOutput {
    @builtin(position) Position: vec4f,
    @location(0) uv: vec2f,
  }

`;
