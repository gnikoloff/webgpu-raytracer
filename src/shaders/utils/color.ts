import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  // Narkowicz 2015, "ACES Filmic Tone Mapping Curve"
  @must_use
  fn aces(x: vec3f) -> vec3f {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return saturate(x * (a * x + b)) / (x * (c * x + d) + e);
  }

  // Filmic Tonemapping Operators http://filmicworlds.com/blog/filmic-tonemapping-operators/
  @must_use
  fn filmic(x: vec3f) -> vec3f {
    let X = max(vec3f(0.0), x - 0.004);
    let result = (X * (6.2 * X + 0.5)) / (X * (6.2 * X + 1.7) + 0.06);
    return pow(result, vec3(2.2));
  }

  // Lottes 2016, "Advanced Techniques and Optimization of HDR Color Pipelines"
  @must_use
  fn lottes(x: vec3f) -> vec3f {
    let a = vec3f(1.6);
    let d = vec3f(0.977);
    let hdrMax = vec3f(8.0);
    let midIn = vec3f(0.18);
    let midOut = vec3f(0.267);

    let b =
        (-pow(midIn, a) + pow(hdrMax, a) * midOut) /
        ((pow(hdrMax, a * d) - pow(midIn, a * d)) * midOut);
    let c =
        (pow(hdrMax, a * d) * pow(midIn, a) - pow(hdrMax, a) * pow(midIn, a * d) * midOut) /
        ((pow(hdrMax, a * d) - pow(midIn, a * d)) * midOut);

    return pow(x, a) / (pow(x, a * d) * b + c);
  }

  @must_use
  fn reinhard(x: vec3f) -> vec3f {
    return x / (1.0 + x);
  }
`;
