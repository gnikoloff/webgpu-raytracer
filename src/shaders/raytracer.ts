import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

import UtilsShaderChunk from "./utils/utils";
import CommonShaderChunk from "./utils/common";
import RayShaderChunk from "./utils/ray";
import VecShaderChunk from "./utils/vec";
import HittableShaderChunk from "./utils/hittable";
import IntervalShaderChunk from "./utils/interval";
import CameraShaderChunk from "./utils/camera";
import CameraHelpersShaderChunk from "./utils/camera-helpers";
import ColorShaderChunk from "./utils/color";
import MaterialShaderChunk from "./utils/material";
import ShapeShaderChunk from "./utils/shape";

export default wgsl/* wgsl */ `
  const BV_MAX_STACK_DEPTH = 16;
  const EPSILON = 0.001;

  ${UtilsShaderChunk}
  ${CommonShaderChunk}
  ${RayShaderChunk}
  ${ShapeShaderChunk}
  ${VecShaderChunk}
  ${HittableShaderChunk}
  ${IntervalShaderChunk}
  ${CameraShaderChunk}
  ${CameraHelpersShaderChunk}
  ${ColorShaderChunk}
  ${MaterialShaderChunk}

  @group(0) @binding(0) var<storage, read_write> raytraceImageBuffer: array<vec3f>;
  @group(0) @binding(1) var<uniform> commonUniforms: CommonUniforms;
  @group(0) @binding(2) var<uniform> cameraUniforms: Camera;

  @group(1) @binding(0) var<storage, read> faces: array<Face>;
  @group(1) @binding(1) var<storage, read> AABBs: array<AABB>;

  override workgroupSizeX: u32;
  override workgroupSizeY: u32;

  @compute @workgroup_size(workgroupSizeX, workgroupSizeY)
  fn main(@builtin(global_invocation_id) globalInvocationId : vec3<u32>,) {
    if (any(globalInvocationId.xy > cameraUniforms.viewportSize)) {
      return;
    }

    init_rand(globalInvocationId);

    let pos = globalInvocationId.xy;
    let x = f32(pos.x);
    let y = f32(pos.y);
    let idx = pos.x + pos.y * cameraUniforms.viewportSize.x;

    var camera = cameraUniforms;
    initCamera(&camera);

    var spheres: array<Sphere, 5>;
    spheres[0] = Sphere(vec3(0, -100.5, -1), 100, 0);
    spheres[1] = Sphere(vec3(0, 0, -1), 0.5, 1);
    spheres[2] = Sphere(vec3(-1, 0, -1), 0.5, 2);
    spheres[3] = Sphere(vec3(-1, 0, -1), -0.4, 2);
    spheres[4] = Sphere(vec3(1, 0, -1), 0.5, 3);

    var materials: array<Material, 4>;
    materials[0] = makeLambertianMaterial(vec3f(0.8, 0.8, 0.0));
    materials[1] = makeLambertianMaterial(vec3f(0.1, 0.2, 0.5));
    materials[2] = makeDielectricMaterial(1.5);
    materials[3] = makeMetalMaterial(vec3f(0.8, 0.6, 0.2), 0.0);
    
    var color = vec3f(0);
    let numSamples: i32 = 10;

    var hitRec: HitRecord;

    var throughput = vec3f(1);

    var a = faces[0];
    var b = AABBs[0];

    var radiance = vec3f(0);
    var r = getCameraRay(&camera, x, y);
    for (var rayBounce = 0u; rayBounce < commonUniforms.maxBounces; rayBounce++) { 
      if (rayIntersectBVH(&r, &hitRec, positiveUniverseInterval)) {
        var scattered: Ray;
        var attenuation: vec3f;
        var material = materials[hitRec.materialIdx];

        var scatters = false;

        if (material.materialType == MATERIAL_LAMBERTIAN) {
          scatters = scatterLambertian(&material, &r, &scattered, &hitRec, &attenuation);
        } else if (material.materialType == MATERIAL_METAL) {
          scatters = scatterMetal(&material, &r, &scattered, &hitRec, &attenuation);
        } else if (material.materialType == MATERIAL_DIELECTRIC) {
          scatters = scatterDielectric(&material, &r, &scattered, &hitRec, &attenuation);
        }

        // radiance += emission * throughput;
        if (scatters) {
          radiance += 0.01 * throughput;
        } else {
          radiance += 0 * throughput;
          break;
        }
        
        r = scattered;

        throughput *= attenuation;
      } else {
        let unit_direction =  normalize(r.direction);
        let a = 0.5*(unit_direction.y + 1.0);
        let skyColor = (1.0-a)*vec3f(1.0, 1.0, 1.0) + a*vec3f(0.5, 0.7, 1.0);
        radiance += skyColor * throughput;
        break;
      }
    }

    color += radiance;

    let weight = 1.0 / f32(commonUniforms.frameCounter + 1);
    var prevColor = vec3f(0);
    if (commonUniforms.frameCounter == 0) {
      raytraceImageBuffer[idx] = prevColor;
    } else {
      prevColor = raytraceImageBuffer[idx];
    }
    
    raytraceImageBuffer[idx] = (1.0 - weight) * prevColor + weight * color;
  }
`;
