import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct Camera {
    aspectRatio: f32,
    imageWidth: f32,
    imageHeight: f32,
    center: vec3<f32>,
    pixel00Loc: vec3<f32>,
    pixelDeltaU: vec3<f32>,
    pixelDeltaV: vec3<f32>,
  }

  fn initCamera(camera: ptr<function, Camera>) {
    (*camera).imageHeight = (*camera).imageWidth / (*camera).aspectRatio;
    (*camera).imageHeight = select((*camera).imageHeight, 1, (*camera).imageHeight < 1);

    (*camera).center = vec3(0, 0, 1);

    let focalLength = 1.0;
    let viewportHeight = 2.0;
    let viewportWidth = viewportHeight * ((*camera).imageWidth / (*camera).imageHeight);

    let viewportU = vec3(viewportWidth, 0, 0);
    let viewportV = vec3(0, -viewportHeight, 0);

    (*camera).pixelDeltaU = viewportU / (*camera).imageWidth;
    (*camera).pixelDeltaV = viewportV / (*camera).imageHeight;

    let viewportUpperLeft = (*camera).center - vec3(0, 0, focalLength) - viewportU / 2 - viewportV / 2;
    (*camera).pixel00Loc = viewportUpperLeft + 0.5 * ((*camera).pixelDeltaU + (*camera).pixelDeltaV);
  }

  fn getCameraRay(camera: ptr<function, Camera>, i: f32, j: f32) -> Ray {
    let pixelCenter = (*camera).pixel00Loc + (i * (*camera).pixelDeltaU) + (j * (*camera).pixelDeltaV);
    let pixelSample = pixelCenter + pixelSampleSquare(camera);
    let rayOrigin = (*camera).center;
    let rayDirection = pixelSample - rayOrigin;
    return Ray(rayOrigin, rayDirection);
  }

  fn pixelSampleSquare(camera: ptr<function, Camera>) -> vec3<f32> {
    let px = -0.5 + rand();
    let py = -0.5 + rand();
    return (px * (*camera).pixelDeltaU) + (py * (*camera).pixelDeltaV);
  }

  fn rayColor(ray: ptr<function, Ray>, spheres: array<Sphere, 4>) -> vec3f {
    var rec: HitRecord;
    if (spheresHit(ray, &rec, Interval(0, f32max), spheres)) {
      return 0.5 * (rec.normal + vec3f(1.0, 1.0, 1.0));
    }
    let unitDirection = normalize((*ray).direction);
    let a = 0.5 * (unitDirection.y + 1.0);
    return (1.0-a) * vec3(1.0, 1.0, 1.0) + a * vec3(0.5, 0.7, 1.0);
  }

`;
