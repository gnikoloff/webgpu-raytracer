struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) uv : vec2<f32>,
}

@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
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