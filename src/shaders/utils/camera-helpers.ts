import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  fn initCamera(camera: ptr<function, Camera>) {
    (*camera).imageHeight = (*camera).imageWidth / (*camera).aspectRatio;
    (*camera).imageHeight = select((*camera).imageHeight, 1, (*camera).imageHeight < 1);

    (*camera).center = (*camera).lookFrom;

    let theta = radians((*camera).vfov);
    let h = tan(theta * 0.5);
    let viewportHeight = 2.0 * h * (*camera).focusDist;
    let viewportWidth = viewportHeight * ((*camera).imageWidth / (*camera).imageHeight);

    let w = normalize((*camera).lookFrom - (*camera).lookAt);
    let u = normalize(cross((*camera).vup, w));
    let v = cross(w, u);

    let viewportU = viewportWidth * u;
    let viewportV = viewportHeight * -v;

    (*camera).pixelDeltaU = viewportU / (*camera).imageWidth;
    (*camera).pixelDeltaV = viewportV / (*camera).imageHeight;

    let viewportUpperLeft = (*camera).center - ((*camera).focusDist * w) - viewportU / 2 - viewportV / 2;
    (*camera).pixel00Loc = viewportUpperLeft + 0.5 * ((*camera).pixelDeltaU + (*camera).pixelDeltaV);

    let defocusRadius = (*camera).focusDist * tan(radians((*camera).defocusAngle * 0.5));
    (*camera).defocusDiscU = u * defocusRadius;
    (*camera).defocusDiscV = v * defocusRadius;
  }

  @must_use
  fn getCameraRay(camera: ptr<function, Camera>, i: f32, j: f32) -> Ray {
    let pixelCenter = (*camera).pixel00Loc + (i * (*camera).pixelDeltaU) + (j * (*camera).pixelDeltaV);
    let pixelSample = pixelCenter + pixelSampleSquare(camera);
    let rayOrigin = select(defocusDiskSample(camera), (*camera).center, (*camera).defocusAngle <= 0);
    let rayDirection = pixelSample - rayOrigin;
    return Ray(rayOrigin, rayDirection);
  }

  @must_use
  fn defocusDiskSample(camera: ptr<function, Camera>) -> vec3f {
    let p = randomVec3InUnitDisc();
    return (*camera).center + (p.x * (*camera).defocusDiscU) + (p.y * (*camera).defocusDiscV);
  }

  @must_use
  fn pixelSampleSquare(camera: ptr<function, Camera>) -> vec3<f32> {
    let px = -0.5 + rand();
    let py = -0.5 + rand();
    return (px * (*camera).pixelDeltaU) + (py * (*camera).pixelDeltaV);
  }

  @must_use
  fn rayColor(ray: ptr<function, Ray>, spheres: array<Sphere, 5>) -> vec3f {
    var rec: HitRecord;
    if (spheresHit(ray, &rec, Interval(0, f32max), spheres)) {
      return 0.5 * (rec.normal + vec3f(1.0, 1.0, 1.0));
    }
    let unitDirection = normalize((*ray).direction);
    let a = 0.5 * (unitDirection.y + 1.0);
    return (1.0-a) * vec3(1.0, 1.0, 1.0) + a * vec3(0.5, 0.7, 1.0);
  }
`;
