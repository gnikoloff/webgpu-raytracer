import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  const f32min = 0x1p-126f;
  const f32max = 0x1.fffffep+127;

  // A psuedo random number. Initialized with init_rand(), updated with rand().
  var<private> rnd : vec3u;

  // Initializes the random number generator.
  fn init_rand(invocation_id : vec3u) {
    const A = vec3(1741651 * 1009,
                  140893  * 1609 * 13,
                  6521    * 983  * 7 * 2);
    rnd = (invocation_id * A) ^ commonUniforms.seed;
  }

  // Returns a random number between 0 and 1.
  fn rand() -> f32 {
    const C = vec3(60493  * 9377,
                  11279  * 2539 * 23,
                  7919   * 631  * 5 * 3);

    rnd = (rnd * C) ^ (rnd.yzx >> vec3(4u));
    return f32(rnd.x ^ rnd.y) / 4294967295.0; // 4294967295.0 is f32(0xffffffff). See #337
  }

  fn randInRange(min: f32, max: f32) -> f32 {
    return min + rand() * (max - min);
  }
`;
