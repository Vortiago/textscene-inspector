/**
 * Godot `StandardMaterial3D` emission, decomposed into what three.js offers.
 *
 * The one home for this arithmetic, because emission arrives by two routes — an
 * inline `SubResource` material read as raw strings, and an external `.tres` read
 * as typed properties — and the two rendering the same material differently is
 * exactly the bug this replaces.
 *
 * Godot's generated fragment code is
 *
 *     EMISSION = (emission.rgb + emission_tex) * emission_energy;   // ADD
 *     EMISSION = (emission.rgb * emission_tex) * emission_energy;   // MULTIPLY
 *
 * over a `uniform vec4 emission : source_color` and a `sampler2D
 * texture_emission : source_color, hint_default_black`. Both hints are
 * load-bearing: `source_color` means the colour is sRGB→linear converted BEFORE
 * the energy multiply, and `hint_default_black` means an ABSENT texture samples
 * as zero rather than white.
 */

import type { Color } from './types';
import { sRGBToLinearRGB } from '../../../utils/colorSpace';

/** Godot `BaseMaterial3D.EmissionOperator`. */
export const EmissionOperator = {
  ADD: 0,
  MULTIPLY: 1,
} as const;

export interface EmissionScalars {
  /**
   * Linear RGB in [0,1]; `[0,0,0]` means "no emission". An ARRAY, not a hex
   * number, so r3f applies it via `Color.fromArray` (already-linear, no decode).
   * A hex number would go through `Color.setHex(hex, SRGBColorSpace)`, decoding
   * these already-linear values sRGB→linear a SECOND time and rendering emission
   * far too dark. The albedo colour is an array for the same reason.
   */
  emissive: [number, number, number];
  emissiveIntensity: number;
}

/**
 * The authored colour and energy as a linear colour plus an intensity.
 *
 * Deliberately separate from `resolveEmission`: the inline-SubResource path
 * cannot resolve the operator until it knows whether a texture landed, which is
 * only knowable in the component, so the two must stay independently callable
 * even though the external-`.tres` path has both facts at once.
 *
 * The sRGB→linear conversion has to happen BEFORE the peak is taken, because it
 * is not a linear function: normalising first and scaling after is a different
 * mapping. For `Color(2, 0.5, 0)` that difference is `(2, 0.102, 0)` against
 * Godot's `(4.954, 0.214, 0)` — wrong in magnitude AND hue. Since the peak is
 * what the glow bright-pass gates on, the error also changes what blooms.
 *
 * three carries emission as a [0,1] colour times an unbounded intensity, so the
 * linear colour is split at its peak: the peak becomes the intensity and the hue
 * survives undistorted.
 */
export function emissionScalars(
  color: Color | undefined,
  energy: number,
  enabled = true
): EmissionScalars {
  if (!enabled) return { emissive: [0, 0, 0], emissiveIntensity: 0 };
  const linear = color ? sRGBToLinearRGB(color.r, color.g, color.b) : null;
  const peak = linear ? Math.max(linear[0], linear[1], linear[2], 1) : 1;
  return {
    emissive: linear ? [linear[0] / peak, linear[1] / peak, linear[2] / peak] : [0, 0, 0],
    emissiveIntensity: Math.max(0, energy * peak),
  };
}

/**
 * The colour and texture combined the way `emission_operator` says.
 *
 * `hint_default_black` on the sampler decides three of the five cases:
 *
 *   MULTIPLY, no texture  → `emission * 0 * energy`, i.e. no emission at all.
 *       A Godot content trap, faithfully reproduced: the material looks unlit
 *       however bright its colour.
 *   MULTIPLY, texture     → exactly three's own `emissive * tex * intensity`.
 *   ADD, no texture       → `emission * energy`; the texture term is zero.
 *   ADD, texture, black colour → `(0 + tex) * energy` reduces to `tex * energy`,
 *       which three spells as a WHITE emissive at the same intensity. This is the
 *       case that matters most: Godot's `emission` defaults to black, so a
 *       material carrying only an emission texture omits the colour entirely, and
 *       multiplying that black through would render nothing where Godot renders
 *       the full texture.
 *
 * PARITY LIMITATION (ADD, texture, non-black colour): `(emission + tex)` is a sum
 * three's multiply-only emissive chain cannot express. The colour is applied as a
 * multiply instead, so such a material reads darker and more tinted than Godot's.
 */
export function resolveEmission(
  scalars: EmissionScalars,
  operator: number | undefined,
  hasEmissiveMap: boolean
): EmissionScalars {
  const { emissive, emissiveIntensity } = scalars;
  if (operator === EmissionOperator.MULTIPLY) {
    return hasEmissiveMap
      ? { emissive, emissiveIntensity }
      : { emissive: [0, 0, 0], emissiveIntensity: 0 };
  }
  const colourIsBlack = emissive[0] === 0 && emissive[1] === 0 && emissive[2] === 0;
  if (hasEmissiveMap && colourIsBlack) {
    return { emissive: [1, 1, 1], emissiveIntensity };
  }
  return { emissive, emissiveIntensity };
}
