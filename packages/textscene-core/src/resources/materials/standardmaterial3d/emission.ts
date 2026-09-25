/**
 * Godot `StandardMaterial3D` emission in three.js terms, one home for both arrival routes.
 * Godot computes `(emission.rgb + emission_tex) * emission_energy`, or `*` for MULTIPLY.
 * `source_color` converts the colour to linear before the energy multiply, and
 * `hint_default_black` samples an absent texture as zero.
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
   * Linear RGB in [0,1], `[0,0,0]` for no emission. An array, which r3f applies with
   * `Color.fromArray`: a hex number goes through `Color.setHex(hex, SRGBColorSpace)`,
   * which decodes these linear values again. The albedo colour is an array too.
   */
  emissive: [number, number, number];
  emissiveIntensity: number;
}

/**
 * The authored colour and energy as a linear colour plus an intensity. It stays apart
 * from `resolveEmission`, since the inline path learns whether a texture landed only
 * in the component.
 */
export function emissionScalars(
  color: Color | undefined,
  energy: number,
  enabled = true
): EmissionScalars {
  if (!enabled) return { emissive: [0, 0, 0], emissiveIntensity: 0 };
  // Convert before taking the peak, as sRGB→linear is not linear: for `Color(2, 0.5, 0)`
  // the other order gives `(2, 0.102, 0)` against Godot's `(4.954, 0.214, 0)`.
  const linear = color ? sRGBToLinearRGB(color.r, color.g, color.b) : null;
  // three's emission is a [0,1] colour times an unbounded intensity, so the colour
  // splits at its peak, which the glow bright pass gates on, and the hue survives.
  const peak = linear ? Math.max(linear[0], linear[1], linear[2], 1) : 1;
  // Floored at zero per channel: the peak is `max(..., 1)`, so dividing by it
  // cannot lift a negative channel back up, and a negative emissive subtracts
  // light from the surface rather than adding none.
  return {
    emissive: linear
      ? [
          Math.max(0, linear[0] / peak),
          Math.max(0, linear[1] / peak),
          Math.max(0, linear[2] / peak),
        ]
      : [0, 0, 0],
    emissiveIntensity: Math.max(0, energy * peak),
  };
}

/**
 * The colour and texture combined the way `emission_operator` says. `hint_default_black`
 * on the sampler decides three of the five cases.
 */
export function resolveEmission(
  scalars: EmissionScalars,
  operator: number | undefined,
  hasEmissiveMap: boolean
): EmissionScalars {
  const { emissive, emissiveIntensity } = scalars;
  // With a texture this is three's own `emissive * tex * intensity`. Without one it is
  // `emission * 0 * energy`, a Godot content trap reproduced: no emission at all.
  if (operator === EmissionOperator.MULTIPLY) {
    return hasEmissiveMap
      ? { emissive, emissiveIntensity }
      : { emissive: [0, 0, 0], emissiveIntensity: 0 };
  }
  const colourIsBlack = emissive[0] === 0 && emissive[1] === 0 && emissive[2] === 0;
  // `(0 + tex) * energy` is a white emissive in three. Godot's `emission` defaults to
  // black, so a material with only an emission texture omits the colour.
  if (hasEmissiveMap && colourIsBlack) {
    return { emissive: [1, 1, 1], emissiveIntensity };
  }
  // ADD without a texture is `emission * energy`. With a texture and a non-black colour
  // this is a parity limitation: three's multiply-only chain cannot express the sum,
  // so the material reads darker and more tinted than Godot's.
  return { emissive, emissiveIntensity };
}
