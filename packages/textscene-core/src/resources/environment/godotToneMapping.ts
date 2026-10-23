/**
 * Godot's tonemapping curves, ported for three's `CustomToneMapping` hook. No three
 * curve is Godot's: Godot scales input by an `exposure_bias` and divides by the curve
 * at `tonemap_white`, so white maps to 1.0. FILMIC's bias of 2.0 alone brightens by
 * 1.73x, and three's Cineon in its place measures a flat 13% dark against Godot.
 */

/*
 * The curves are derived from Godot Engine (`drivers/gles3/shaders/
 * tonemap_inc.glsl`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md for the full notice.
 */

import { glslFloat } from '../../utils/glslLiterals';
import {
  ACES_CURVE,
  FILMIC_CURVE,
  TONEMAP_AGX_CONTRAST_DEFAULT,
  ToneMapper,
  toneMappingWhiteParam,
} from '../../godot/rendering/environment/toneMapping.js';

/**
 * The GLSL function that takes the place of three's `CustomToneMapping` stub, per mode. three
 * does NOT apply `toneMappingExposure` for the custom hook, so each curve multiplies it in first,
 * as Godot does with `tonemap_exposure`. The white is a per-environment constant, baked in so no
 * material declares a uniform for it.
 */
export function customToneMappingFunction(
  mode: number,
  white: number,
  agxContrast = TONEMAP_AGX_CONTRAST_DEFAULT
): string {
  return /* glsl */ `vec3 CustomToneMapping(vec3 color) {
  color *= toneMappingExposure;
${curveGlsl(mode, white, agxContrast)}
}`;
}

/**
 * The same curve as the final pass after bloom, since bloom reads pre-tonemap HDR and three cannot
 * tonemap in-material then. The caller applies exposure first. Every mode gets a body: LINEAR returns
 * its input, so no consumer supplies a fifth.
 */
export function toneMappingEffectGlsl(
  mode: number,
  white: number,
  agxContrast = TONEMAP_AGX_CONTRAST_DEFAULT
): string {
  return /* glsl */ `
vec3 godotToneMap(vec3 color) {
${curveGlsl(mode, white, agxContrast)}
}
`;
}

/** The mode's curve on an exposed `color`, with the white it reads baked in, so both paths draw alike. */
function curveGlsl(mode: number, white: number, agxContrast: number): string {
  const body = (CURVES[mode] ?? UNKNOWN_MODE_CURVE)(agxContrast);
  return `  const float godotToneMapWhite = ${glslFloat(toneMappingWhiteParam(mode, white))};\n${body}`;
}

/**
 * One builder per mode. Every curve takes the AgX contrast even though only AgX
 * reads it: a table of mixed shapes would have each consumer decide which arm it
 * is calling, and the point of the table is that they cannot tell.
 */
type CurveBody = (agxContrast: number) => string;

/**
 * A mode outside the enum takes the AgX branch (`tonemap.glsl:266-268`) with the parameters
 * `environment_get_tonemap_parameters` leaves zeroed (`environment_storage.cpp:279-339`). A channel
 * under 0.18 maps to x^0 / (x^0 + 0) = 1 and one above divides 0 by 0, so Godot writes white.
 */
const UNKNOWN_MODE_CURVE: CurveBody = () => /* glsl */ `  return vec3(1.0);`;

/** `tonemap.glsl:256-258`: every curve but LINEAR starts at black, so a negative light cannot drive it. */
const NON_NEGATIVE_GLSL = /* glsl */ `  color = max(color, vec3(0.0));`;

const CURVES: Record<number, CurveBody> = {
  // LINEAR: exposure is the whole transform.
  [ToneMapper.LINEAR]: () => /* glsl */ `  return color;`,

  // Reinhard's extended formula, equation 4 in https://doi.org/cjbgrt
  [ToneMapper.REINHARDT]: () => /* glsl */ `
${NON_NEGATIVE_GLSL}
  float white_squared = godotToneMapWhite;
  vec3 white_squared_color = white_squared * color;
  return (white_squared_color + color * color) / (white_squared_color + white_squared);`,

  [ToneMapper.FILMIC]: () => /* glsl */ `
${NON_NEGATIVE_GLSL}
  const float exposure_bias = ${glslFloat(FILMIC_CURVE.exposureBias)};
  const float A = ${glslFloat(FILMIC_CURVE.A)} * exposure_bias * exposure_bias;
  const float B = ${glslFloat(FILMIC_CURVE.B)} * exposure_bias;
  const float C = ${glslFloat(FILMIC_CURVE.C)};
  const float D = ${glslFloat(FILMIC_CURVE.D)};
  const float E = ${glslFloat(FILMIC_CURVE.E)};
  const float F = ${glslFloat(FILMIC_CURVE.F)};
  vec3 tonemapped = ((color * (A * color + C * B) + D * E) / (color * (A * color + B) + D * F)) - E / F;
  return tonemapped / godotToneMapWhite;`,

  [ToneMapper.ACES]: () => /* glsl */ `
${NON_NEGATIVE_GLSL}
  const float exposure_bias = ${glslFloat(ACES_CURVE.exposureBias)};
  const float A = ${glslFloat(ACES_CURVE.A)};
  const float B = ${glslFloat(ACES_CURVE.B)};
  const float C = ${glslFloat(ACES_CURVE.C)};
  const float D = ${glslFloat(ACES_CURVE.D)};
  const float E = ${glslFloat(ACES_CURVE.E)};
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

  // EaryChow's AgX from Godot 4.6.3's `tonemap.glsl` (`tonemap_agx`, `allenwp_curve`),
  // on linear light, unlike three's log2 approximation. Its harder toe crushes a shadowed
  // ambient-lit surface toward black. The parameters repeat Godot's CPU arithmetic
  // (`environment_get_tonemap_parameters`) in-shader, so AgX keeps the bake-a-literal seam.
  [ToneMapper.AGX]: (agxContrast) => /* glsl */ `
${NON_NEGATIVE_GLSL}

  const mat3 rec709_to_rec2020_agx_inset = mat3(
      0.544814746488245, 0.140416948464053, 0.0888104196149096,
      0.373787398372697, 0.754137554567394, 0.178871756420858,
      0.0813978551390581, 0.105445496968552, 0.732317823964232);
  const mat3 agx_outset_rec2020_to_rec709 = mat3(
      1.96488741169489, -0.299313364904742, -0.164352742528393,
      -0.855988495690215, 1.32639796461980, -0.238183969428088,
      -0.108898916004672, -0.0270845997150571, 1.40253671195648);

  const float awp_contrast = ${glslFloat(agxContrast)};
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
