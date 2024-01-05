import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

import UtilsShaderChunk from "./utils/utils";
import CommonShaderChunk from "./utils/common";
import RayShaderChunk from "./utils/ray";
import VecShaderChunk from "./utils/vec";
import HittableShaderChunk from "./utils/hittable";
import IntervalShaderChunk from "./utils/interval";
import CameraShaderChunk from "./utils/camera";

export type WorkGroupSize = [number, number, number];

export default wgsl/* wgsl */ `

  @group(0) @binding(0) var<storage, read_write> raytraceImageBuffer: array<vec3f>;
  @group(0) @binding(1) var<uniform> commonUniforms: CommonUniforms;

  override workgroupSizeX: u32;
  override workgroupSizeY: u32;

  ${UtilsShaderChunk}
  ${CommonShaderChunk}
  ${RayShaderChunk}
  ${VecShaderChunk}
  ${HittableShaderChunk}
  ${IntervalShaderChunk}
  ${CameraShaderChunk}

  @compute @workgroup_size(workgroupSizeX, workgroupSizeY)
  fn main(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(global_invocation_id) globalInvocationId : vec3<u32>,
    @builtin(local_invocation_id) LocalInvocationID : vec3<u32>,
    // @builtin(workgroup_id) WorkGroupID : vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index : u32,
    @builtin(num_workgroups) num_workgroups: vec3<u32>
  ) {
    if (any(globalInvocationId.xy > commonUniforms.viewportSize)) {
      return;
    }

    init_rand(globalInvocationId);

    let pos = globalInvocationId.xy;

    // let baseIndex = workgroup_id.xy + LocalInvocationID.xy;


    let x = f32(pos.x);
    let y = f32(pos.y);


    let idx = pos.x + pos.y * commonUniforms.viewportSize.x;

    var camera: Camera;
    camera.imageWidth = f32(commonUniforms.viewportSize.x);
    camera.aspectRatio = f32(commonUniforms.viewportSize.x) / f32(commonUniforms.viewportSize.y);
    initCamera(&camera);

    let pixelCenter = camera.pixel00Loc + (x * camera.pixelDeltaU) + (y * camera.pixelDeltaV);
    let rayDirection = pixelCenter - camera.center;

    var spheres: array<Sphere, 4>;
    spheres[0] = Sphere(vec3(0, -100.5, -1), 100);
    spheres[2] = Sphere(vec3(0, 105, -1), 100);
    spheres[3] = Sphere(vec3(0, 105, -200), 300);
    spheres[1] = Sphere(vec3(0, 0, -1), 0.5);
    
    var color = vec3f(0);
    let numSamples: i32 = 10;

    var r = Ray(camera.center, rayDirection);
    var hitRec: HitRecord;

    let maxBounces = 3;
    var frac = vec3f(1);

    var rayBounce: i32;

    var radiance = vec3f(0);
    for (var samples = 0; samples < 1; samples++) {
      var r = getCameraRay(&camera, x, y);
      for (rayBounce = 0; rayBounce < maxBounces; rayBounce++) {
        if (spheresHit(&r, &hitRec, Interval(0.001, f32max), spheres)) {
          var sphereColor: vec3f;
          var emission = vec3f(0.3);
          if (hitRec.meshIdx == 0) {
            sphereColor = vec3f(1, 0, 0);
          } else if (hitRec.meshIdx == 1) {
            sphereColor = vec3f(0.3);
          } else if (hitRec.meshIdx == 2) {
            sphereColor = vec3f(0, 0, 1);
            emission = vec3f(0.6);
          } else {
            sphereColor = vec3f(0.2, 1, 1);
          }

          radiance += emission * frac;
          
          r.origin = hitRec.p;
          r.direction = randomUnitVec3OnHemisphere(hitRec.normal);
          frac *= sphereColor * 2 * dot(hitRec.normal, r.direction);
        } else {
          break;
        }
      }
    }

    color += radiance;

    let weight = 1.0 / f32(commonUniforms.frameCounter + 1);
    let prevColor = raytraceImageBuffer[idx];
    raytraceImageBuffer[idx] = (1.0 - weight) * prevColor + weight * color;

    // textureStore(raytracedTexture, pos, vec4(color, 1));
  }
`;
