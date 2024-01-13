import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct Camera {
    viewportSize: vec2u,
    imageWidth: f32,
    imageHeight: f32,
    pixel00Loc: vec3<f32>,
    pixelDeltaU: vec3<f32>,
    pixelDeltaV: vec3<f32>,

    aspectRatio: f32,
    center: vec3<f32>,
    vfov: f32,

    lookFrom: vec3f,
    lookAt: vec3f,
    vup: vec3f,

    defocusAngle: f32,
    focusDist: f32,

    defocusDiscU: vec3f,
    defocusDiscV: vec3f
  }

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
`;
