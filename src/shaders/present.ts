import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

import CameraShaderChunk from "./utils/camera";
import CommonShaderChunk from "./utils/common";
import ColorShaderChunk from "./utils/color";
import VertexShaderChunk from "./utils/vertex";

export default wgsl/* wgsl */ `
  ${CameraShaderChunk}
  ${ColorShaderChunk}
  ${VertexShaderChunk}
  ${CommonShaderChunk}

  @group(0) @binding(0) var<storage, read_write> raytraceImageBuffer: array<vec3f>;
  @group(0) @binding(1) var<uniform> cameraUniforms: Camera;
  @group(0) @binding(2) var<uniform> commonUniforms: CommonUniforms;

  // xy pos + uv
  const FULLSCREEN_QUAD = array<vec4<f32>, 6>(
    vec4(-1, 1, 0, 0),
    vec4(-1, -1, 0, 1),
    vec4(1, -1, 1, 1),
    vec4(-1, 1, 0, 0),
    vec4(1, -1, 1, 1),
    vec4(1, 1, 1, 0)
  );

  @vertex
  fn vertexMain(@builtin(vertex_index) VertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    output.Position = vec4<f32>(FULLSCREEN_QUAD[VertexIndex].xy, 0.0, 1.0);
    output.uv = FULLSCREEN_QUAD[VertexIndex].zw;
    return output;
  }

  @fragment
  fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4f {
    let x = u32(uv.x * f32(cameraUniforms.viewportSize.x));
    let y = u32(uv.y * f32(cameraUniforms.viewportSize.y));
    let idx = x + y * cameraUniforms.viewportSize.x;
    let color = lottes(raytraceImageBuffer[idx] / f32(commonUniforms.frameCounter + 1));
    return vec4f(color, 1.0);
  }
`;
