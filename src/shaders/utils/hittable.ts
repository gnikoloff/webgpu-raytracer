import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct HitRecord {
    p: vec3f,
    normal: vec3f,
    t: f32,
    frontFace: bool,
    meshIdx: i32
  };

  fn hitRecordSetFaceNormal(
    recordPtr: ptr<function, HitRecord>,
    rayPtr: ptr<function, Ray>,
    outwardNormal: vec3f
  ) {
    let frontFace = dot((*rayPtr).direction, outwardNormal) < 0;
    (*recordPtr).frontFace = frontFace;
    (*recordPtr).normal = select(-outwardNormal, outwardNormal, frontFace);
  }

  struct Sphere {
    center: vec3f,
    radius: f32,
  };

  fn sphereHit(
    spherePtr: ptr<function, Sphere>,
    rayPtr: ptr<function, Ray>,
    recordPtr: ptr<function, HitRecord>,
    rayInterval: Interval
  ) -> bool {
    let sphere = *spherePtr;
    let ray = *rayPtr;

    let oc = ray.origin - sphere.center;
    let a = dot(ray.direction, ray.direction);
    let halfB = dot(oc, ray.direction);
    let c = dot(oc, oc) - sphere.radius * sphere.radius;
    let discriminant = halfB * halfB - a * c;
    if (discriminant < 0) {
      return false;
    }

    let sqrtd = sqrt(discriminant);
    var root = (-halfB - sqrtd) / a;
    if (!intervalSurrounds(rayInterval, root)) {
      root = (-halfB + sqrtd) / a;
      if (!intervalSurrounds(rayInterval, root)) {
        return false;
      }
    }

    (*recordPtr).t = root;
    let p = rayAt(rayPtr, (*recordPtr).t);
    (*recordPtr).p = p;
    let outwardNormal = (p - sphere.center) / sphere.radius;
    hitRecordSetFaceNormal(recordPtr, rayPtr, outwardNormal);

    return true;
  }

  fn spheresHit(
    ray: ptr<function, Ray>,
    rec: ptr<function, HitRecord>,
    interval: Interval,
    spheres: array<Sphere, 4>
  ) -> bool {  
    var tempRec: HitRecord;
    var hitAnything = false;
    var closestSoFar = interval.max;
    (*rec).meshIdx = -1;
    for (var i = 0; i < 4; i++) {
      var sphere = spheres[i];
      if (sphereHit(&sphere, ray, &tempRec, Interval(interval.min, closestSoFar))) {
        hitAnything = true;
        closestSoFar = tempRec.t;
        *rec = tempRec;
        (*rec).meshIdx = i;
      }
    }
    return hitAnything;
  }

`;
