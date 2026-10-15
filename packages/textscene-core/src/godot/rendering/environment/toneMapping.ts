/**
 * Godot 4.6.3's tone-mapping white on the CPU: the floor `environment_get_white` puts on the
 * authored white and the parameter `environment_get_tonemap_parameters` derives from it, both in
 * `servers/rendering/storage/environment_storage.cpp`. The shaders divide by that parameter.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

/** `Environment.ToneMapper` (`scene/resources/environment.h:64-70`). */
export const ToneMapper = {
  LINEAR: 0,
  REINHARDT: 1,
  FILMIC: 2,
  ACES: 3,
  AGX: 4,
} as const;

/** `exposure_bias` per curve (`environment_storage.cpp:292,303`). The shaders bake the same. */
const FILMIC_EXPOSURE_BIAS = 2.0;
const ACES_EXPOSURE_BIAS = 1.8;

/** Hable's filmic curve with Godot's bias folded into A and B (`environment_storage.cpp:292-300`). */
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
 * ACES for a neutral grey, which is all the white needs (`environment_storage.cpp:303-312`). Both
 * of Godot's colour matrices have rows summing to 1, so a grey passes through them as a plain scale
 * by the exposure bias.
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
 * `environment_get_white` (`environment_storage.cpp:226-260`): the authored white after a
 * per-curve floor, because glow's SCREEN blend fails for a white under 1.0. The curve's
 * normalisation and SCREEN's glow clamp both read this. The desktop and Forward+ AgX floor is 2.0,
 * and an unknown mode falls through to Reinhard's branch.
 */
export function resolvedWhite(mode: number, white: number): number {
  switch (mode) {
    case ToneMapper.AGX:
      return Math.max(2, white);
    case ToneMapper.LINEAR:
      return 1;
    default:
      return Math.max(1, white);
  }
}

/**
 * The `tonemapper_params.x` of `environment_get_tonemap_parameters`
 * (`environment_storage.cpp:274-344`): white squared for Reinhard, and the curve at white for FILMIC and ACES, so white maps to 1.0. For
 * AgX it is the high-clip point, where the curve reaches `output_max`. LINEAR has none, so 1.
 */
export function toneMappingWhiteParam(mode: number, white: number): number {
  const resolved = resolvedWhite(mode, white);
  switch (mode) {
    case ToneMapper.REINHARDT:
      return resolved * resolved;
    case ToneMapper.FILMIC:
      return filmic(resolved);
    case ToneMapper.ACES:
      return acesGrey(resolved);
    case ToneMapper.AGX:
      return resolved;
    default:
      return 1;
  }
}
