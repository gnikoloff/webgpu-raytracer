import { wgsl } from "wgsl-preprocessor/wgsl-preprocessor.js";

export default wgsl/* wgsl */ `
  struct Interval {
    min: f32,
    max: f32,
  };

  fn intervalContains(interval: Interval, x: f32) -> bool {
    return interval.min <= x && x <= interval.max;
  }

  fn intervalSurrounds(interval: Interval, x: f32) -> bool {
    return interval.min < x && x < interval.max;
  }

  fn intervalClamp(interval: Interval, x: f32) -> f32 {
    var out = x;
    if (x < interval.min) {
      out = interval.min;
    }
    if (x > interval.max) {
      out = interval.max;
    }
    return out;
  }

  const emptyInterval = Interval(f32max, f32min);
  const universeInterval = Interval(f32min, f32max);
`;