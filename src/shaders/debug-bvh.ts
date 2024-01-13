import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

import CommonShaderChunk from "./utils/common";
import VertexShaderChunk from "./utils/vertex";

export default wgsl/* wgsl */ `
  ${CommonShaderChunk}
  ${VertexShaderChunk}

  @group(0) @binding(0) var<storage, read> AABBs: array<AABB>;
  @group(0) @binding(1) var<uniform> viewProjectionMatrix: mat4x4f;

  const EDGES_PER_CUBE = 12u;

  @vertex
  fn vertexMain(
    @builtin(instance_index) instanceIndex: u32,
    @builtin(vertex_index) vertexIndex: u32
  ) -> @builtin(position) vec4f {
    let lineInstanceIdx = instanceIndex % EDGES_PER_CUBE;
    let aabbInstanceIdx = instanceIndex / EDGES_PER_CUBE;
    let a = AABBs[aabbInstanceIdx];
    var pos: vec3f;
    let fVertexIndex = f32(vertexIndex);
                  
    //        a7 _______________ a6
    //         / |             /|
    //        /  |            / |
    //    a4 /   |       a5  /  |
    //      /____|__________/   |
    //      |    |__________|___|
    //      |   / a3        |   / a2
    //      |  /            |  /
    //      | /             | /
    //      |/______________|/
    //      a0              a1

    let dx = a.max.x - a.min.x;
    let dy = a.max.y - a.min.y;
    let dz = a.max.z - a.min.z;
    
    let a0 = a.min;
    let a1 = vec3f(a.min.x + dx, a.min.y,      a.min.z     );
    let a2 = vec3f(a.min.x + dx, a.min.y,      a.min.z + dz);
    let a3 = vec3f(a.min.x,      a.min.y,      a.min.z + dz);
    let a4 = vec3f(a.min.x,      a.min.y + dy, a.min.z     );
    let a5 = vec3f(a.min.x + dx, a.min.y + dy, a.min.z     );
    let a6 = a.max;
    let a7 = vec3f(a.min.x,      a.min.y + dy, a.min.z + dz);

    if (lineInstanceIdx == 0) {
      pos = mix(a0, a1, fVertexIndex);
    } else if (lineInstanceIdx == 1) {
      pos = mix(a1, a2, fVertexIndex);
    } else if (lineInstanceIdx == 2) {
      pos = mix(a2, a3, fVertexIndex);
    } else if (lineInstanceIdx == 3) {
      pos = mix(a0, a3, fVertexIndex);
    } else if (lineInstanceIdx == 4) {
      pos = mix(a0, a4, fVertexIndex);
    } else if (lineInstanceIdx == 5) {
      pos = mix(a1, a5, fVertexIndex);
    } else if (lineInstanceIdx == 6) {
      pos = mix(a2, a6, fVertexIndex);
    } else if (lineInstanceIdx == 7) {
      pos = mix(a3, a7, fVertexIndex);
    } else if (lineInstanceIdx == 8) {
      pos = mix(a4, a5, fVertexIndex);
    } else if (lineInstanceIdx == 9) {
      pos = mix(a5, a6, fVertexIndex);
    } else if (lineInstanceIdx == 10) {
      pos = mix(a6, a7, fVertexIndex);
    } else if (lineInstanceIdx == 11) {
      pos = mix(a7, a4, fVertexIndex);
    }
    return viewProjectionMatrix * vec4(pos, 1);
  }

  @fragment
  fn fragmentMain() -> @location(0) vec4f {
    return vec4f(0.01);
  }

`;
