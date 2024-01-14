import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

import UtilsShaderChunk from "./utils/utils";
import CommonShaderChunk from "./utils/common";
import RayShaderChunk from "./utils/ray";
import VecShaderChunk from "./utils/vec";
import IntervalShaderChunk from "./utils/interval";
import CameraShaderChunk from "./utils/camera";
import ColorShaderChunk from "./utils/color";
import MaterialShaderChunk from "./utils/material";

export default wgsl/* wgsl */ `
  const BV_MAX_STACK_DEPTH = 16;
  const EPSILON = 0.001;

  ${UtilsShaderChunk}
  ${CommonShaderChunk}
  ${RayShaderChunk}
  ${VecShaderChunk}
  ${IntervalShaderChunk}
  ${CameraShaderChunk}
  ${ColorShaderChunk}
  ${MaterialShaderChunk}

  @group(0) @binding(0) var<storage, read_write> raytraceImageBuffer: array<vec3f>;
  @group(0) @binding(1) var<storage, read_write> rngStateBuffer: array<u32>;
  @group(0) @binding(2) var<uniform> commonUniforms: CommonUniforms;
  @group(0) @binding(3) var<uniform> cameraUniforms: Camera;

  @group(1) @binding(0) var<storage, read> faces: array<Face>;
  @group(1) @binding(1) var<storage, read> AABBs: array<AABB>;
  @group(1) @binding(2) var<storage, read> materials: array<Material>;

  override WORKGROUP_SIZE_X: u32;
  override WORKGROUP_SIZE_Y: u32;
  override OBJECTS_COUNT_IN_SCENE: u32;
  override MAX_BVs_COUNT_PER_MESH: u32;
  override MAX_FACES_COUNT_PER_MESH: u32;

  @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
  fn main(@builtin(global_invocation_id) globalInvocationId : vec3<u32>,) {
    if (any(globalInvocationId.xy > cameraUniforms.viewportSize)) {
      return;
    }

    let pos = globalInvocationId.xy;
    let x = f32(pos.x);
    let y = f32(pos.y);
    let idx = pos.x + pos.y * cameraUniforms.viewportSize.x;

    var rngState = rngStateBuffer[idx];

    var camera = cameraUniforms;
    initCamera(&camera);
    
    var hitRec: HitRecord;

    var r = getCameraRay(&camera, x, y, &rngState);

    var color = vec3f(0);

    var mtlStack: array<Material, 16>;
    var bLoop = true;
    var i = 0u;

    while(bLoop && rayIntersectBVH(&r, &hitRec, positiveUniverseInterval)) {
      var scattered: Ray;
      var material = materials[hitRec.materialIdx];
      var albedo = material.albedo;
      
      mtlStack[i] = material;

      if (commonUniforms.debugNormals == 1u) {
        color = (hitRec.normal + 1) * 0.5;
        break;
      }

      switch material.materialType {
        case 0: {
          color = material.albedo;
          bLoop = false;
          break;
        }
        case 1: {
          if (i < commonUniforms.maxBounces) {
            var scatters = scatterMetal(&material, &r, &scattered, &hitRec, &albedo, &rngState);
            if (scatters) {
              i++;
              r = scattered;
            } else {
              color = vec3f(0);
              bLoop = false;
              i = 0u;
            }
          } else {
            color = material.albedo;
            bLoop = false;
          }
          break;
        }
        case 2: {
          if (i < commonUniforms.maxBounces) {
            var scatters = scatterDielectric(&material, &r, &scattered, &hitRec, &albedo, &rngState);  
            r = scattered;
            i++;
          } else {
            color = mtlStack[i].albedo;
            bLoop = false;
          }
          break;
        }
        case 3: {
          var scatters = scatterLambertian(&material, &r, &scattered, &hitRec, &albedo, &rngState);
          if (i < commonUniforms.maxBounces) {
            i++;
            r = scattered;
          } else {
            bLoop = false;
          }
          break;
        }
        default: {
          // ... 
        }
      }
    }


    while (i > 0) {
      i--;
      color *= mtlStack[i].albedo;
    }

    var pixel = raytraceImageBuffer[idx];

    if (commonUniforms.frameCounter == 0) {
      pixel = vec3f(0);
    }

    pixel += color;
    raytraceImageBuffer[idx] = pixel;

    rngStateBuffer[idx] = rngState;
  }
`;
