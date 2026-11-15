/**
 * Björn Ottosson's OKLab, ported from `thirdparty/misc/ok_color.h`: the space a Gradient blends in
 * at `GRADIENT_COLOR_SPACE_OKLAB` and the base of OKHSL. Every step runs in float, as the header's
 * `float` maths does, since a grey's hue is the angle of its float rounding noise.
 *
 * Portions ported from Godot Engine (MIT) and `thirdparty/misc/ok_color.h`
 * (MIT, Copyright (c) 2021 Björn Ottosson).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

const f32 = Math.fround;

/** `a * x + b * y + c * z`, each step rounded to float. */
function dotF32(a: number, x: number, b: number, y: number, c: number, z: number): number {
  return f32(f32(f32(f32(a) * x) + f32(f32(b) * y)) + f32(f32(c) * z));
}

/** `linear_srgb_to_oklab` (`ok_color.h:67-82`). */
export function linearSrgbToOklab(c: LinearRgb): Lab {
  const l = dotF32(0.4122214708, c.r, 0.5363325363, c.g, 0.0514459929, c.b);
  const m = dotF32(0.2119034982, c.r, 0.6806995451, c.g, 0.1073969566, c.b);
  const s = dotF32(0.0883024619, c.r, 0.2817188376, c.g, 0.6299787005, c.b);

  const l_ = f32(Math.cbrt(l));
  const m_ = f32(Math.cbrt(m));
  const s_ = f32(Math.cbrt(s));

  return {
    L: dotF32(0.2104542553, l_, 0.793617785, m_, -0.0040720468, s_),
    a: dotF32(1.9779984951, l_, -2.428592205, m_, 0.4505937099, s_),
    b: dotF32(0.0259040371, l_, 0.7827717662, m_, -0.808675766, s_),
  };
}

/** `oklab_to_linear_srgb` (`ok_color.h:84-99`). */
export function oklabToLinearSrgb(c: Lab): LinearRgb {
  const l_ = dotF32(1, c.L, 0.3963377774, c.a, 0.2158037573, c.b);
  const m_ = dotF32(1, c.L, -0.1055613458, c.a, -0.0638541728, c.b);
  const s_ = dotF32(1, c.L, -0.0894841775, c.a, -1.291485548, c.b);

  const l = f32(f32(l_ * l_) * l_);
  const m = f32(f32(m_ * m_) * m_);
  const s = f32(f32(s_ * s_) * s_);

  return {
    r: dotF32(4.0767416621, l, -3.3077115913, m, 0.2309699292, s),
    g: dotF32(-1.2684380046, l, 2.6097574011, m, -0.3413193965, s),
    b: dotF32(-0.0041960863, l, -0.7034186147, m, 1.707614701, s),
  };
}
