/**
 * OKHSL to and from sRGB, ported from `thirdparty/misc/ok_color.h` through the
 * `set_ok_hsl` and `get_ok_hsl_*` of `core/math/color.cpp`, for `MODE_OKHSL` (`color_mode.cpp`).
 * Only the OKHSL half is ported: OKHSV and `gamut_clip_*` have no caller.
 *
 * Portions ported from Godot Engine (MIT) and `thirdparty/misc/ok_color.h`
 * (MIT, Copyright (c) 2021 Björn Ottosson).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { ControlColor } from '../control/types';

interface Lab {
  L: number;
  a: number;
  b: number;
}
interface RGB {
  r: number;
  g: number;
  b: number;
}
interface LC {
  L: number;
  C: number;
}
interface ST {
  S: number;
  T: number;
}

/** `srgb_transfer_function` (`ok_color.h:57-60`): the curve of `Color::linear_to_srgb`, with the constants of `ok_color.h`. */
function srgbTransferFunction(a: number): number {
  return 0.0031308 >= a ? 12.92 * a : 1.055 * Math.pow(a, 1 / 2.4) - 0.055;
}

/** `srgb_transfer_function_inv` (`ok_color.h:62-65`). */
function srgbTransferFunctionInv(a: number): number {
  return 0.04045 < a ? Math.pow((a + 0.055) / 1.055, 2.4) : a / 12.92;
}

/** `linear_srgb_to_oklab` (`ok_color.h:67-82`). */
function linearSrgbToOklab(c: RGB): Lab {
  const l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  const m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  const s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

/** `oklab_to_linear_srgb` (`ok_color.h:84-99`). */
function oklabToLinearSrgb(c: Lab): RGB {
  const l_ = c.L + 0.3963377774 * c.a + 0.2158037573 * c.b;
  const m_ = c.L - 0.1055613458 * c.a - 0.0638541728 * c.b;
  const s_ = c.L - 0.0894841775 * c.a - 1.2914855480 * c.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

/** `compute_max_saturation` (`ok_color.h:104-166`). `a` and `b` are normalised so `a^2 + b^2 == 1`. */
function computeMaxSaturation(a: number, b: number): number {
  let k0: number, k1: number, k2: number, k3: number, k4: number, wl: number, wm: number, ws: number;

  if (-1.88170328 * a - 0.80936493 * b > 1) {
    k0 = 1.19086277;
    k1 = 1.76576728;
    k2 = 0.59662641;
    k3 = 0.75515197;
    k4 = 0.56771245;
    wl = 4.0767416621;
    wm = -3.3077115913;
    ws = 0.2309699292;
  } else if (1.81444104 * a - 1.19445276 * b > 1) {
    k0 = 0.73956515;
    k1 = -0.45954404;
    k2 = 0.08285427;
    k3 = 0.1254107;
    k4 = 0.14503204;
    wl = -1.2684380046;
    wm = 2.6097574011;
    ws = -0.3413193965;
  } else {
    k0 = 1.35733652;
    k1 = -0.00915799;
    k2 = -1.1513021;
    k3 = -0.50559606;
    k4 = 0.00692167;
    wl = -0.0041960863;
    wm = -0.7034186147;
    ws = 1.707614701;
  }

  let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

  const k_l = 0.3963377774 * a + 0.2158037573 * b;
  const k_m = -0.1055613458 * a - 0.0638541728 * b;
  const k_s = -0.0894841775 * a - 1.291485548 * b;

  const l_ = 1 + S * k_l;
  const m_ = 1 + S * k_m;
  const s_ = 1 + S * k_s;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const l_dS = 3 * k_l * l_ * l_;
  const m_dS = 3 * k_m * m_ * m_;
  const s_dS = 3 * k_s * s_ * s_;

  const l_dS2 = 6 * k_l * k_l * l_;
  const m_dS2 = 6 * k_m * k_m * m_;
  const s_dS2 = 6 * k_s * k_s * s_;

  const f = wl * l + wm * m + ws * s;
  const f1 = wl * l_dS + wm * m_dS + ws * s_dS;
  const f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;

  S = S - (f * f1) / (f1 * f1 - 0.5 * f * f2);

  return S;
}

/** `find_cusp` (`ok_color.h:170-181`). */
function findCusp(a: number, b: number): LC {
  const S_cusp = computeMaxSaturation(a, b);
  const rgbAtMax = oklabToLinearSrgb({ L: 1, a: S_cusp * a, b: S_cusp * b });
  const L_cusp = Math.cbrt(1 / Math.max(rgbAtMax.r, rgbAtMax.g, rgbAtMax.b));
  const C_cusp = L_cusp * S_cusp;
  return { L: L_cusp, C: C_cusp };
}

/**
 * `find_gamut_intersection` (`ok_color.h:187-270`), the overload that takes a
 * cusp. Its only caller, `get_Cs`, has one.
 */
function findGamutIntersection(a: number, b: number, L1: number, C1: number, L0: number, cusp: LC): number {
  let t: number;
  if ((L1 - L0) * cusp.C - (cusp.L - L0) * C1 <= 0) {
    t = (cusp.C * L0) / (C1 * cusp.L + cusp.C * (L0 - L1));
  } else {
    t = (cusp.C * (L0 - 1)) / (C1 * (cusp.L - 1) + cusp.C * (L0 - L1));

    const dL = L1 - L0;
    const dC = C1;

    const k_l = 0.3963377774 * a + 0.2158037573 * b;
    const k_m = -0.1055613458 * a - 0.0638541728 * b;
    const k_s = -0.0894841775 * a - 1.291485548 * b;

    const l_dt = dL + dC * k_l;
    const m_dt = dL + dC * k_m;
    const s_dt = dL + dC * k_s;

    const L = L0 * (1 - t) + t * L1;
    const C = t * C1;

    const l_ = L + C * k_l;
    const m_ = L + C * k_m;
    const s_ = L + C * k_s;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const ldt = 3 * l_dt * l_ * l_;
    const mdt = 3 * m_dt * m_ * m_;
    const sdt = 3 * s_dt * s_ * s_;

    const ldt2 = 6 * l_dt * l_dt * l_;
    const mdt2 = 6 * m_dt * m_dt * m_;
    const sdt2 = 6 * s_dt * s_dt * s_;

    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s - 1;
    const r1 = 4.0767416621 * ldt - 3.3077115913 * mdt + 0.2309699292 * sdt;
    const r2 = 4.0767416621 * ldt2 - 3.3077115913 * mdt2 + 0.2309699292 * sdt2;
    const u_r = r1 / (r1 * r1 - 0.5 * r * r2);
    const t_r = -r * u_r;

    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s - 1;
    const g1 = -1.2684380046 * ldt + 2.6097574011 * mdt - 0.3413193965 * sdt;
    const g2 = -1.2684380046 * ldt2 + 2.6097574011 * mdt2 - 0.3413193965 * sdt2;
    const u_g = g1 / (g1 * g1 - 0.5 * g * g2);
    const t_g = -g * u_g;

    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s - 1;
    const b1 = -0.0041960863 * ldt - 0.7034186147 * mdt + 1.707614701 * sdt;
    const b2 = -0.0041960863 * ldt2 - 0.7034186147 * mdt2 + 1.707614701 * sdt2;
    const u_b = b1 / (b1 * b1 - 0.5 * bb * b2);
    const t_b = -bb * u_b;

    const t_r_final = u_r >= 0 ? t_r : Number.MAX_VALUE;
    const t_g_final = u_g >= 0 ? t_g : Number.MAX_VALUE;
    const t_b_final = u_b >= 0 ? t_b : Number.MAX_VALUE;

    t += Math.min(t_r_final, t_g_final, t_b_final);
  }
  return t;
}

/** `toe` (`ok_color.h:403-409`). */
function toe(x: number): number {
  const k_1 = 0.206;
  const k_2 = 0.03;
  const k_3 = (1 + k_1) / (1 + k_2);
  return 0.5 * (k_3 * x - k_1 + Math.sqrt((k_3 * x - k_1) * (k_3 * x - k_1) + 4 * k_2 * k_3 * x));
}

/** `toe_inv` (`ok_color.h:411-417`). */
function toeInv(x: number): number {
  const k_1 = 0.206;
  const k_2 = 0.03;
  const k_3 = (1 + k_1) / (1 + k_2);
  return (x * x + k_1 * x) / (k_3 * (x + k_2));
}

/** `to_ST` (`ok_color.h:419-424`). */
function toST(cusp: LC): ST {
  return { S: cusp.C / cusp.L, T: cusp.C / (1 - cusp.L) };
}

/** `get_ST_mid` (`ok_color.h:429-448`). */
function getSTMid(a_: number, b_: number): ST {
  const S =
    0.11516993 +
    1 /
      (7.4477897 +
        4.1590124 * b_ +
        a_ * (-2.19557347 + 1.75198401 * b_ + a_ * (-2.13704948 - 10.02301043 * b_ + a_ * (-4.24894561 + 5.38770819 * b_ + 4.69891013 * a_))));

  const T =
    0.11239642 +
    1 /
      (1.6132032 -
        0.68124379 * b_ +
        a_ * (0.40370612 + 0.90148123 * b_ + a_ * (-0.27087943 + 0.6122399 * b_ + a_ * (0.00299215 - 0.45399568 * b_ - 0.14661872 * a_))));

  return { S, T };
}

interface Cs {
  C_0: number;
  C_mid: number;
  C_max: number;
}

/** `get_Cs` (`ok_color.h:451-482`). */
function getCs(L: number, a_: number, b_: number): Cs {
  const cusp = findCusp(a_, b_);

  const C_max = findGamutIntersection(a_, b_, L, 1, L, cusp);
  const ST_max = toST(cusp);
  const k = C_max / Math.min(L * ST_max.S, (1 - L) * ST_max.T);

  const ST_mid = getSTMid(a_, b_);
  const C_a = L * ST_mid.S;
  const C_b = (1 - L) * ST_mid.T;
  const C_mid = 0.9 * k * Math.sqrt(Math.sqrt(1 / (1 / (C_a * C_a * C_a * C_a) + 1 / (C_b * C_b * C_b * C_b))));

  const C_a0 = L * 0.4;
  const C_b0 = (1 - L) * 0.8;
  const C_0 = Math.sqrt(1 / (1 / (C_a0 * C_a0) + 1 / (C_b0 * C_b0)));

  return { C_0, C_mid, C_max };
}

/** `Color::from_ok_hsl` and `Color::set_ok_hsl` (`core/math/color.cpp:236-247`) through `okhsl_to_srgb` (`ok_color.h:484-540`), each component clamped to 0..1 as `Color(...).clamp()` does. */
export function okhslToSrgb(h: number, s: number, l: number): ControlColor {
  if (l === 1) return { r: 1, g: 1, b: 1, a: 1 };
  if (l === 0) return { r: 0, g: 0, b: 0, a: 1 };

  const a_ = Math.cos(2 * Math.PI * h);
  const b_ = Math.sin(2 * Math.PI * h);
  const L = toeInv(l);

  const { C_0, C_mid, C_max } = getCs(L, a_, b_);

  const mid = 0.8;
  const mid_inv = 1.25;

  let C: number;
  if (s < mid) {
    const t = mid_inv * s;
    const k_1 = mid * C_0;
    const k_2 = 1 - k_1 / C_mid;
    C = (t * k_1) / (1 - k_2 * t);
  } else {
    const t = (s - mid) / (1 - mid);
    const k_0 = C_mid;
    const k_1 = ((1 - mid) * C_mid * C_mid * mid_inv * mid_inv) / C_0;
    const k_2 = 1 - k_1 / (C_max - C_mid);
    C = k_0 + (t * k_1) / (1 - k_2 * t);
  }

  const rgb = oklabToLinearSrgb({ L, a: C * a_, b: C * b_ });
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  return {
    r: clamp01(srgbTransferFunction(rgb.r)),
    g: clamp01(srgbTransferFunction(rgb.g)),
    b: clamp01(srgbTransferFunction(rgb.b)),
    a: 1,
  };
}

export interface Okhsl {
  h: number;
  s: number;
  l: number;
}

/**
 * `Color::get_ok_hsl_h/s/l` (`core/math/color.cpp:498-534`) through
 * `srgb_to_okhsl` (`ok_color.h:542-593`) in one call. Each value is clamped
 * to 0..1, and NaN becomes 0, as each getter does.
 */
export function srgbToOkhsl(color: Pick<ControlColor, 'r' | 'g' | 'b'>): Okhsl {
  if (color.r === 0 && color.g === 0 && color.b === 0) return { h: 0, s: 0, l: 0 };

  const lab = linearSrgbToOklab({
    r: srgbTransferFunctionInv(color.r),
    g: srgbTransferFunctionInv(color.g),
    b: srgbTransferFunctionInv(color.b),
  });

  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  const a_ = lab.a / C;
  const b_ = lab.b / C;

  const L = lab.L;
  const h = 0.5 + (0.5 * Math.atan2(-lab.b, -lab.a)) / Math.PI;

  const { C_0, C_mid, C_max } = getCs(L, a_, b_);

  const mid = 0.8;
  const mid_inv = 1.25;

  let s: number;
  if (C < C_mid) {
    const k_1 = mid * C_0;
    const k_2 = 1 - k_1 / C_mid;
    const t = C / (k_1 + k_2 * C);
    s = t * mid;
  } else {
    const k_0 = C_mid;
    const k_1 = ((1 - mid) * C_mid * C_mid * mid_inv * mid_inv) / C_0;
    const k_2 = 1 - k_1 / (C_max - C_mid);
    const t = (C - k_0) / (k_1 + k_2 * (C - k_0));
    s = mid + (1 - mid) * t;
  }

  const l = toe(L);

  const clamp01 = (x: number) => (Number.isNaN(x) ? 0 : Math.min(1, Math.max(0, x)));
  return { h: clamp01(h), s: clamp01(s), l: clamp01(l) };
}
