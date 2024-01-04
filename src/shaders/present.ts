import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  @group(0) @binding(0) var mySampler: sampler;
  @group(0) @binding(1) var raytracedTexture: texture_2d<f32>;

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
    return textureSample(raytracedTexture, mySampler, uv);
  }
`;
