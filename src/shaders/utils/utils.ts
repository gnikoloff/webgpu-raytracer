import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  const f32min = 0x1p-126f;
  const f32max = 0x1.fffffep+127;

  const pi = ${Math.PI};

  @must_use
  fn rngNextFloat(state: ptr<function, u32>) -> f32 {
    rngNextInt(state);
    return f32(*state) / f32(0xffffffffu);
  }

  fn rngNextInt(state: ptr<function, u32>) {
    // PCG random number generator
    // Based on https://www.shadertoy.com/view/XlGcRh

    let oldState = *state + 747796405u + 2891336453u;
    let word = ((oldState >> ((oldState >> 28u) + 4u)) ^ oldState) * 277803737u;
    *state = (word >> 22u) ^ word;
  }

  @must_use
  fn randInRange(min: f32, max: f32, state: ptr<function, u32>) -> f32 {
    return min + rngNextFloat(state) * (max - min);
  }
`;
