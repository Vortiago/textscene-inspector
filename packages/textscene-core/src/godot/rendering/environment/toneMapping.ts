/**
 * Godot 4.6.3's tone-mapping facts: the curve constants, which the CPU white and the ported shaders
 * both read, and the white on the CPU, that is the floor `environment_get_white` puts on the authored
 * white and the parameter `environment_get_tonemap_parameters` derives from it, both in
 * `servers/rendering/storage/environment_storage.cpp`. The shaders divide by that parameter.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/** `Environment.ToneMapper` (`scene/resources/environment.h:64-70`). */
export const ToneMapper = {
  LINEAR: 0,
  REINHARDT: 1,
  FILMIC: 2,
  ACES: 3,
  AGX: 4,
} as const;

/**
 * `tonemap_agx_contrast` when a scene stores none (`scene/resources/environment.h:119`), inside its
 * hint `"1.0,2.0,0.01,or_greater"` (`environment.cpp:1290`).
 */
export const TONEMAP_AGX_CONTRAST_DEFAULT = 1.25;

/** Each tone mapper's name by the integer a `.tscn` stores, as a validator names it. */
export const TONE_MAPPER_NAMES = enumNamesByValue(ToneMapper);

/**
 * Hable's filmic curve with Godot's bias (`environment_storage.cpp:292-300`, `tonemap.glsl`
 * `tonemap_filmic`). The bias scales A by its square and B by itself, inside the curve.
 */
export const FILMIC_CURVE = {
  exposureBias: 2.0,
  A: 0.22,
  B: 0.3,
  C: 0.1,
  D: 0.2,
  E: 0.01,
  F: 0.3,
} as const;

/**
 * Godot's fitted ACES (`environment_storage.cpp:303-312`, `tonemap.glsl` `tonemap_aces`). The bias
 * scales the colour before the curve.
 */
export const ACES_CURVE = {
  exposureBias: 1.8,
  A: 0.0245786,
  B: 0.000090537,
  C: 0.983729,
  D: 0.432951,
  E: 0.238081,
} as const;

/**
 * The tonemap pass's own defaults (`tone_mapper.h:177-180`), which a 3D root with no Environment
 * keeps (`renderer_scene_render_rd.cpp:724-731`). They equal the Environment defaults
 * (`environment.h:115-117`) only by chance, so neither is read from the other.
 */
export const NO_ENVIRONMENT_TONE_MAPPING = {
  mode: ToneMapper.LINEAR,
  exposure: 1,
  white: 1,
  agxContrast: TONEMAP_AGX_CONTRAST_DEFAULT,
};

function filmic(x: number): number {
  const { exposureBias: bias, A, B, C, D, E, F } = FILMIC_CURVE;
  const biasedA = A * bias * bias;
  const biasedB = B * bias;
  return (x * (biasedA * x + C * biasedB) + D * E) / (x * (biasedA * x + biasedB) + D * F) - E / F;
}

/**
 * ACES for a neutral grey, which is all the white needs. Both of Godot's colour matrices have rows
 * summing to 1, so a grey passes through them as a plain scale by the exposure bias.
 */
function acesGrey(x: number): number {
  const { exposureBias, A, B, C, D, E } = ACES_CURVE;
  const biased = x * exposureBias;
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
 * (`environment_storage.cpp:274-344`): white squared for Reinhard, and the curve at white for
 * FILMIC and ACES, so white maps to 1.0. For AgX it is the high-clip point, where the curve
 * reaches `output_max`. LINEAR has none, so 1.
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
