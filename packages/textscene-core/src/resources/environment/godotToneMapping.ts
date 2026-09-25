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

import { glslFloat } from './glslLiterals';
import { DEFAULT_AGX_CONTRAST } from './types';

/** Godot `ToneMapper`. */
export const GodotToneMapper = {
  LINEAR: 0,
  REINHARDT: 1,
  FILMIC: 2,
  ACES: 3,
  AGX: 4,
} as const;

/** `exposure_bias` per curve. Godot bakes these into the shader constants. */
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
 * ACES for a neutral grey, which is all the normalisation constant needs. Both of
 * Godot's colour matrices have rows summing to 1, so a grey passes through them as a
 * plain scale by the exposure bias.
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
 * Godot's `environment_get_white` (`servers/rendering/storage/environment_storage.cpp`):
 * the authored white after a per-curve floor, because "Glow with screen blend mode does
 * not work when white < 1.0". The curve's normalisation and SCREEN's glow clamp both
 * read this, as Godot hands both the same result.
 */
export function resolvedWhite(mode: number, white: number): number {
  switch (mode) {
    // The desktop and Forward+ floor. The 10-bit Mobile path pins a flat 2.0.
    case GodotToneMapper.AGX:
      return Math.max(2, white);
    // `output_max_value`: LINEAR ignores the authored value.
    case GodotToneMapper.LINEAR:
      return 1;
    // FILMIC, ACES and REINHARDT.
    default:
      return Math.max(1, white);
  }
}

/**
 * The `tonemapper_params.x` Godot computes on the CPU from the resolved white
 * (`environment_get_tonemap_parameters`): white squared for Reinhard, and the curve at
 * white for FILMIC and ACES, so white maps to 1.0. For AgX it is the high-clip point,
 * where the curve reaches `output_max`, and the AgX GLSL derives its other parameters from it.
 */
export function toneMappingWhiteParam(mode: number, white: number): number {
  const resolved = resolvedWhite(mode, white);
  switch (mode) {
    case GodotToneMapper.REINHARDT:
      return resolved * resolved;
    case GodotToneMapper.FILMIC:
      return filmic(resolved);
    case GodotToneMapper.ACES:
      return acesGrey(resolved);
    case GodotToneMapper.AGX:
      return resolved;
    default:
      return 1;
  }
}

/**
 * The GLSL body for `CustomToneMapping`, per mode. three calls this after its
 * own `toneMappingExposure` is in scope but does NOT apply it for the custom
 * hook, so each curve multiplies it in first, which is also where Godot puts
 * `tonemap_exposure`.
 */
export function toneMappingShaderChunk(
  mode: number,
  agxContrast = DEFAULT_AGX_CONTRAST
): string {
  const body = (CURVES[mode] ?? LINEAR_CURVE)(agxContrast);
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
 * The same curve as the final pass after bloom, since bloom reads pre-tonemap HDR and
 * three cannot tonemap in-material then. It bakes the white in, as `toneMapping.ts`
 * does. Every mode gets a body: LINEAR is the curve that applies exposure and nothing
 * else, so no consumer supplies a fifth.
 */
export function toneMappingEffectGlsl(
  mode: number,
  white: number,
  agxContrast = DEFAULT_AGX_CONTRAST
): string {
  const body = (CURVES[mode] ?? LINEAR_CURVE)(agxContrast);
  const bakedWhite = glslFloat(toneMappingWhiteParam(mode, white));
  return /* glsl */ `
vec3 godotToneMap(vec3 color, float exposure) {
  const float godotToneMapWhite = ${bakedWhite};
  color *= exposure;
${body}
}
`;
}

/**
 * One builder per mode. Every curve takes the AgX contrast even though only AgX
 * reads it: a table of mixed shapes would have each consumer decide which arm it
 * is calling, and the point of the table is that they cannot tell.
 */
type CurveBody = (agxContrast: number) => string;

/** LINEAR: exposure is the whole transform. */
const LINEAR_CURVE: CurveBody = () => /* glsl */ `  return color;`;

const CURVES: Record<number, CurveBody> = {
  // Reinhard's extended formula, equation 4 in https://doi.org/cjbgrt
  [GodotToneMapper.REINHARDT]: () => /* glsl */ `
  float white_squared = godotToneMapWhite;
  vec3 white_squared_color = white_squared * color;
  return (white_squared_color + color * color) / (white_squared_color + white_squared);`,

  [GodotToneMapper.FILMIC]: () => /* glsl */ `
  const float exposure_bias = 2.0;
  const float A = 0.22 * exposure_bias * exposure_bias;
  const float B = 0.30 * exposure_bias;
  const float C = 0.10;
  const float D = 0.20;
  const float E = 0.01;
  const float F = 0.30;
  vec3 tonemapped = ((color * (A * color + C * B) + D * E) / (color * (A * color + B) + D * F)) - E / F;
  return tonemapped / godotToneMapWhite;`,

  [GodotToneMapper.ACES]: () => /* glsl */ `
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

  // EaryChow's AgX from Godot 4.6.3's `tonemap.glsl` (`tonemap_agx`, `allenwp_curve`),
  // on linear light, unlike three's log2 approximation. Its harder toe crushes a shadowed
  // ambient-lit surface toward black. The parameters repeat Godot's CPU arithmetic
  // (`environment_get_tonemap_parameters`) in-shader, so AgX keeps the bake-a-literal seam.
  [GodotToneMapper.AGX]: (agxContrast) => /* glsl */ `
  color = max(color, vec3(0.0));

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

/**
 * Whether this previewer draws `mode` with Godot's own curve. LINEAR is "no tone
 * mapping" and needs no curve. REINHARDT, FILMIC, ACES and AGX are ported from
 * Godot's shader.
 */
export function hasGodotCurve(mode: number): boolean {
  return mode in CURVES;
}
