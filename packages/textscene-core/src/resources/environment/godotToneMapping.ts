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
 * Reinhard wants white squared; the others want the curve at white, which is
 * what normalises the output so white maps to 1.0.
 */
export function toneMappingWhiteParam(mode: number, white: number): number {
  switch (mode) {
    case GodotToneMapper.REINHARDT:
      return white * white;
    case GodotToneMapper.FILMIC:
      return filmic(white);
    case GodotToneMapper.ACES:
      return acesGrey(white);
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
};

/**
 * Whether this previewer draws `mode` with Godot's own curve. LINEAR is
 * "no tone mapping" and needs no curve; AGX falls through to three's own AgX
 * approximation (Godot's is itself "an approximation and simplification of
 * EaryChow's AgX", and the two differ).
 */
export function hasGodotCurve(mode: number): boolean {
  return mode in CURVES;
}
