import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

import CameraShaderChunk from "./utils/camera";
import ColorShaderChunk from "./utils/color";

export default wgsl/* wgsl */ `
  ${CameraShaderChunk}
  ${ColorShaderChunk}

  @group(0) @binding(0) var<storage, read_write> raytraceImageBuffer: array<vec3f>;
  @group(0) @binding(1) var<uniform> cameraUniforms: Camera;

  struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) uv: vec2<f32>,
  }

  @vertex
  fn vertexMain(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var pos = array<vec4<f32>, 6>(
      vec4(-1, 1, 0, 0),
      vec4(-1, -1, 0, 1),
      vec4(1, -1, 1, 1),
      vec4(-1, 1, 0, 0),
      vec4(1, -1, 1, 1),
      vec4(1, 1, 1, 0)
    );

    var output: VertexOutput;

    output.Position = vec4<f32>(pos[VertexIndex].xy, 0.0, 1.0);
    output.uv = pos[VertexIndex].zw;
    return output;
  }

  @fragment
  fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let x = u32(uv.x * f32(cameraUniforms.viewportSize.x));
    let y = u32(uv.y * f32(cameraUniforms.viewportSize.y));
    let idx = x + y * cameraUniforms.viewportSize.x;
    var color = raytraceImageBuffer[idx];

    color = lottes(color);
    return vec4f(color, 1.0);
  }
`;
