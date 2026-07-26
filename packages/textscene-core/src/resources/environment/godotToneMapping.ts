/**
 * Godot's tonemapping curves, ported for three's `CustomToneMapping` hook.
 *
 * three ships Reinhard / Cineon / ACESFilmic / AgX, and none of them is the
 * curve Godot draws with. Measured against a real Godot render of the same
 * fixture (`scripts/godot-ref`), mapping Godot's FILMIC onto three's Cineon
 * left every lit surface at ~0.87 of Godot's value — a flat 13% too dark,
 * consistent across luminances, which is the signature of a wrong curve rather
 * than wrong lighting.
 *
 * The reason is structural: Godot scales its input by an `exposure_bias` and
 * then divides the result by the curve evaluated at `tonemap_white`, so the
 * mapping is normalised to put white at 1.0. FILMIC's bias of 2.0 alone
 * brightens by ~1.73x.
 *
 * ---------------------------------------------------------------------------
 * The curves are derived from Godot Engine (`drivers/gles3/shaders/
 * tonemap_inc.glsl`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md for the full notice.
 * ---------------------------------------------------------------------------
 */

import { glslFloat } from './glslLiterals';

/** Godot `ToneMapper`. */
export const GodotToneMapper = {
  LINEAR: 0,
  REINHARDT: 1,
  FILMIC: 2,
  ACES: 3,
  AGX: 4,
} as const;

/** `exposure_bias` per curve — Godot bakes these into the shader constants. */
const FILMIC_EXPOSURE_BIAS = 2.0;
const ACES_EXPOSURE_BIAS = 1.8;

/** Hable's filmic curve with Godot's bias folded into A and B. */
function filmic(x: number): number {
  const A = 0.22 * FILMIC_EXPOSURE_BIAS * FILMIC_EXPOSURE_BIAS;
  const B = 0.3 * FILMIC_EXPOSURE_BIAS;
  const C = 0.1;
  const D = 0.2;
  const E = 0.01;
  const F = 0.3;
  return (x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F) - E / F;
}

/**
 * ACES for a neutral grey. Both of Godot's colour matrices have rows summing to
 * 1, so a grey passes through them as a plain scale by the exposure bias — all
 * the normalisation constant needs.
 */
function acesGrey(x: number): number {
  const A = 0.0245786;
  const B = 0.000090537;
  const C = 0.983729;
  const D = 0.432951;
  const E = 0.238081;
  const biased = x * ACES_EXPOSURE_BIAS;
  return (biased * (biased + A) - B) / (biased * (C * biased + D) + E);
}

/**
 * The `tonemapper_params.x` Godot computes on the CPU from `tonemap_white`.
 * Reinhard wants white squared; FILMIC/ACES want the curve at white, which is
 * what normalises the output so white maps to 1.0.
 *
 * AgX is different: white is not a normalisation divisor but the shoulder's
 * high-clip point — the input the curve is shaped to just reach `output_max`.
 * Godot's `environment_get_white` floors it at 2.0 for AgX (`max(2, white)` on
 * the desktop/Forward+ path this previewer mirrors), so the default white of
 * 1.0 becomes 2.0. The AgX GLSL reads this as `godotToneMapWhite` and derives
 * the remaining curve parameters from it, exactly as Godot's CPU code does.
 */
export function toneMappingWhiteParam(mode: number, white: number): number {
  switch (mode) {
    case GodotToneMapper.REINHARDT:
      return white * white;
    case GodotToneMapper.FILMIC:
      return filmic(white);
    case GodotToneMapper.ACES:
      return acesGrey(white);
    case GodotToneMapper.AGX:
      return Math.max(2, white);
    default:
      return 1;
  }
}

/**
 * The GLSL body for `CustomToneMapping`, per mode. three calls this after its
 * own `toneMappingExposure` is in scope but does NOT apply it for the custom
 * hook, so each curve multiplies it in first — which is also where Godot puts
 * `tonemap_exposure`.
 */
export function toneMappingShaderChunk(mode: number): string {
  const body = CURVES[mode] ?? 'return color;';
  return /* glsl */ `
uniform float toneMappingExposure;
uniform float godotToneMapWhite;

vec3 CustomToneMapping(vec3 color) {
  color *= toneMappingExposure;
${body}
}
`;
}

/**
 * The same curve, packaged for a full-screen post-process instead of the
 * per-material `CustomToneMapping` hook. When glow is enabled the render layer
 * cannot let three tonemap in-material (bloom must read pre-tonemap HDR), so
 * tonemapping moves to a final pass that runs after bloom — this is its GLSL.
 *
 * Emits a `godotToneMap(vec3, float exposure)` function with the white
 * normalisation baked in, exactly as `toneMapping.ts` bakes it into the chunk.
 * Only LINEAR has no ported curve here (it needs none) — callers treat a `null`
 * return as "no custom curve, apply exposure only". AGX is a real curve on both
 * paths, so it returns GLSL like the others.
 */
export function toneMappingEffectGlsl(mode: number, white: number): string | null {
  const body = CURVES[mode];
  if (body === undefined) return null;
  const bakedWhite = glslFloat(toneMappingWhiteParam(mode, white));
  return /* glsl */ `
vec3 godotToneMap(vec3 color, float exposure) {
  const float godotToneMapWhite = ${bakedWhite};
  color *= exposure;
${body}
}
`;
}

const CURVES: Record<number, string> = {
  // Reinhard's extended formula, equation 4 in https://doi.org/cjbgrt
  [GodotToneMapper.REINHARDT]: /* glsl */ `
  float white_squared = godotToneMapWhite;
  vec3 white_squared_color = white_squared * color;
  return (white_squared_color + color * color) / (white_squared_color + white_squared);`,

  [GodotToneMapper.FILMIC]: /* glsl */ `
  const float exposure_bias = 2.0;
  const float A = 0.22 * exposure_bias * exposure_bias;
  const float B = 0.30 * exposure_bias;
  const float C = 0.10;
  const float D = 0.20;
  const float E = 0.01;
  const float F = 0.30;
  vec3 tonemapped = ((color * (A * color + C * B) + D * E) / (color * (A * color + B) + D * F)) - E / F;
  return tonemapped / godotToneMapWhite;`,

  [GodotToneMapper.ACES]: /* glsl */ `
  const float exposure_bias = 1.8;
  const float A = 0.0245786;
  const float B = 0.000090537;
  const float C = 0.983729;
  const float D = 0.432951;
  const float E = 0.238081;
  const mat3 rgb_to_rrt = mat3(
      vec3(0.59719 * exposure_bias, 0.35458 * exposure_bias, 0.04823 * exposure_bias),
      vec3(0.07600 * exposure_bias, 0.90834 * exposure_bias, 0.01566 * exposure_bias),
      vec3(0.02840 * exposure_bias, 0.13383 * exposure_bias, 0.83777 * exposure_bias));
  const mat3 odt_to_rgb = mat3(
      vec3(1.60475, -0.53108, -0.07367),
      vec3(-0.10208, 1.10813, -0.00605),
      vec3(-0.00327, -0.07276, 1.07602));
  color *= rgb_to_rrt;
  vec3 tonemapped = (color * (color + A) - B) / (color * (C * color + D) + E);
  tonemapped *= odt_to_rgb;
  return tonemapped / godotToneMapWhite;`,

  // EaryChow's AgX, as shipped in Godot 4.6.3 — `tonemap_agx` and the
  // `allenwp_curve` sigmoid from `tonemap.glsl`. Unlike three's AgX (a
  // different approximation, with a log2 EV encoding and a 6th-order polynomial)
  // this runs directly on linear light: a rec709→rec2020+inset matrix, a
  // piecewise Reinhard-shoulder / power-toe curve about middle grey, a clamp,
  // then an outset+rec2020→rec709 matrix. Its harder toe is what crushes an
  // ambient-lit surface inside a cast shadow toward black, where three's leaves
  // it dim-but-lit.
  //
  // The four curve parameters are `environment_get_tonemap_parameters`'s AgX
  // branch, computed here from `godotToneMapWhite` (Godot's `high_clip`, i.e.
  // `max(2, white)`) and `awp_contrast`. Godot fills these on the CPU into a
  // push constant; recomputing them in-shader from the one injected white is
  // the same arithmetic and keeps AgX on the identical single-value injection
  // seam as the curves above. `awp_contrast` is Godot's Environment default of
  // 1.25 (a per-scene `agx_contrast` override is not parsed; see PARITY).
  [GodotToneMapper.AGX]: /* glsl */ `
  color = max(color, vec3(0.0));

  const mat3 rec709_to_rec2020_agx_inset = mat3(
      0.544814746488245, 0.140416948464053, 0.0888104196149096,
      0.373787398372697, 0.754137554567394, 0.178871756420858,
      0.0813978551390581, 0.105445496968552, 0.732317823964232);
  const mat3 agx_outset_rec2020_to_rec709 = mat3(
      1.96488741169489, -0.299313364904742, -0.164352742528393,
      -0.855988495690215, 1.32639796461980, -0.238183969428088,
      -0.108898916004672, -0.0270845997150571, 1.40253671195648);

  const float awp_contrast = 1.25;
  const float awp_crossover_point = 0.18;
  const float output_max_value = 1.0;
  const float awp_shoulder_max = output_max_value - awp_crossover_point;
  float awp_high_clip = godotToneMapWhite;

  float cp_pow_c = pow(awp_crossover_point, awp_contrast);
  float awp_toe_a = ((1.0 / awp_crossover_point) - 1.0) * cp_pow_c;
  float awp_slope_denom = cp_pow_c + awp_toe_a;
  float awp_slope = (awp_contrast * pow(awp_crossover_point, awp_contrast - 1.0) * awp_toe_a) / (awp_slope_denom * awp_slope_denom);
  float awp_w = awp_high_clip - awp_crossover_point;
  awp_w = awp_w * awp_w;
  awp_w = awp_w / awp_shoulder_max;
  awp_w = awp_w * awp_slope;

  color = rec709_to_rec2020_agx_inset * color;

  vec3 s = color - awp_crossover_point;
  vec3 slope_s = awp_slope * s;
  s = slope_s * (1.0 + s / awp_w) / (1.0 + (slope_s / awp_shoulder_max));
  s += awp_crossover_point;
  vec3 t = pow(color, vec3(awp_contrast));
  t = t / (t + awp_toe_a);
  color = mix(s, t, lessThan(color, vec3(awp_crossover_point)));

  color = min(vec3(output_max_value), color);
  color = agx_outset_rec2020_to_rec709 * color;
  // Godot's linear_to_srgb clamps to [0, 1] before the sRGB OETF; fold that in
  // here, because the outset matrix's negative excursions on saturated colours
  // would otherwise reach three's sRGB encode as NaN.
  return clamp(color, 0.0, 1.0);`,
};

/**
 * Whether this previewer draws `mode` with Godot's own curve. LINEAR is
 * "no tone mapping" and needs no curve; every other mode — REINHARDT, FILMIC,
 * ACES and AGX — is ported from Godot's shader.
 */
export function hasGodotCurve(mode: number): boolean {
  return mode in CURVES;
}
