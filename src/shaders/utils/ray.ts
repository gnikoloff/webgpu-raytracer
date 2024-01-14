import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct Ray {
    origin: vec3f,
    direction: vec3f,
  };

  @must_use
  fn rayAt(ray: ptr<function, Ray>, t: f32) -> vec3f {
    return (*ray).origin + (*ray).direction * t;
  }

  @must_use
  fn rayIntersectFace(
    ray: ptr<function, Ray>,
    face: ptr<function, Face>,
    rec: ptr<function, HitRecord>,
    interval: Interval
  ) -> bool {
    // Mäller-Trumbore algorithm
    // https://en.wikipedia.org/wiki/Möller–Trumbore_intersection_algorithm

    // let fnDotRayDir = dot((*face).faceNormal, (*ray).direction);
    // if (abs(fnDotRayDir) < EPSILON) {
    //   return false; // ray direction almost parallel
    // }

    let e1 = (*face).p1 - (*face).p0;
    let e2 = (*face).p2 - (*face).p0;

    let h = cross((*ray).direction, e2);
    let det = dot(e1, h);

    if det > -0.00001 && det < 0.00001 {
      return false;
    }

    let invDet = 1.0f / det;
    let s = (*ray).origin - (*face).p0;
    let u = invDet * dot(s, h);

    if u < 0.0f || u > 1.0f {
      return false;
    }

    let q = cross(s, e1);
    let v = invDet * dot((*ray).direction, q);

    if v < 0.0f || u + v > 1.0f {
      return false;
    }

    let t = invDet * dot(e2, q);

    if t > interval.min && t < interval.max {
      // https://www.scratchapixel.com/lessons/3d-basic-rendering/ray-tracing-rendering-a-triangle/moller-trumbore-ray-triangle-intersection.html
      
      let p = (*face).p0 + u * e1 + v * e2;
      // *hit = TriangleHit(offsetRay(p, n), b, t);
      (*rec).t = t;
      (*rec).p = p;
      (*rec).materialIdx = (*face).materialIdx;
      if (commonUniforms.flatShading == 1u) {
        (*rec).normal = (*face).faceNormal;
      } else {
        let b = vec3f(1f - u - v, u, v);
        let n = b[0] * (*face).n0 + b[1] * (*face).n1 + b[2] * (*face).n2;
        (*rec).normal = n;
      }
      return true;
    } else {
      return false;
    }
  }


  @must_use
  fn rayIntersectBV(ray: ptr<function, Ray>, aabb: ptr<function, AABB>) -> bool {
    let t0 = ((*aabb).min - (*ray).origin) / (*ray).direction;
    let t1 = ((*aabb).max - (*ray).origin) / (*ray).direction;
    let tmin = min(t0, t1);
    let tmax = max(t0, t1);
    let maxMinT = max(tmin.x, max(tmin.y, tmin.z));
    let minMaxT = min(tmax.x, min(tmax.y, tmax.z));
    return maxMinT < minMaxT;
  }

  @must_use
  fn rayIntersectBVH(
    ray: ptr<function, Ray>,
    hitRec: ptr<function, HitRecord>,
    interval: Interval
  ) -> bool {
    
    var current: HitRecord;
    var didIntersect = false;
    var stack: array<i32, BV_MAX_STACK_DEPTH>;

    (*hitRec).t = f32max;
    
    var top: i32;

    for (var objIdx = 0u; objIdx < OBJECTS_COUNT_IN_SCENE; objIdx++) {
      top = 0;
      stack[0] = 0;

      while (top > -1) {
        var bvIdx = stack[top];
        top--;
        var aabb = AABBs[u32(bvIdx) + objIdx * MAX_BVs_COUNT_PER_MESH];
        
        if (rayIntersectBV(ray, &aabb)) {
          if (aabb.leftChildIdx != -1) {
            top++;
            stack[top] = aabb.leftChildIdx;
          }
          if (aabb.rightChildIdx != -1) {
            top++;
            stack[top] = aabb.rightChildIdx;
          }

          if (aabb.faceIdx0 != -1) {
            var face = faces[u32(aabb.faceIdx0) + objIdx * MAX_FACES_COUNT_PER_MESH];
            if (
              rayIntersectFace(ray, &face, &current, positiveUniverseInterval) &&
              current.t < (*hitRec).t
            ) {
              *hitRec = current;
              didIntersect = true;
            }
          }

          if (aabb.faceIdx1 != -1) {
            var face = faces[u32(aabb.faceIdx1) + objIdx * MAX_FACES_COUNT_PER_MESH];
            if (
              rayIntersectFace(ray, &face, &current, positiveUniverseInterval) &&
              current.t < (*hitRec).t
            ) {
              *hitRec = current;
              didIntersect = true;
            }
          }
        }
      }
    }
    return didIntersect;
  }

  @must_use
  fn getCameraRay(camera: ptr<function, Camera>, i: f32, j: f32, rngState: ptr<function, u32>) -> Ray {
    let pixelCenter = (*camera).pixel00Loc + (i * (*camera).pixelDeltaU) + (j * (*camera).pixelDeltaV);
    let pixelSample = pixelCenter + pixelSampleSquare(camera, rngState);
    let rayOrigin = select(defocusDiskSample(camera, rngState), (*camera).center, (*camera).defocusAngle <= 0);
    let rayDirection = pixelSample - rayOrigin;
    return Ray(rayOrigin, rayDirection);
  }

  @must_use
  fn defocusDiskSample(camera: ptr<function, Camera>, rngState: ptr<function, u32>) -> vec3f {
    let p = randomVec3InUnitDisc(rngState);
    return (*camera).center + (p.x * (*camera).defocusDiscU) + (p.y * (*camera).defocusDiscV);
  }

  @must_use
  fn pixelSampleSquare(camera: ptr<function, Camera>, rngState: ptr<function, u32>) -> vec3<f32> {
    let px = -0.5 + rngNextFloat(rngState);
    let py = -0.5 + rngNextFloat(rngState);
    return (px * (*camera).pixelDeltaU) + (py * (*camera).pixelDeltaV);
  }
`;
