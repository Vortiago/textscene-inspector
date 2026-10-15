/**
 * Godot `StandardMaterial3D` emission in three.js terms, one home for both arrival routes.
 * Godot computes `(emission.rgb + emission_tex) * emission_energy`, or `*` for MULTIPLY.
 * `source_color` converts the colour to linear before the energy multiply, and
 * `hint_default_black` samples an absent texture as zero.
 */

import { sRGBToLinearRGB } from '../../../utils/colorSpace';
import type { Rgba } from '../../../godot/math/math';
import { EmissionOperator } from '../../../godot/rendering/materials/emissionOperator';

export interface EmissionScalars {
  /**
   * Linear RGB in [0,1], `[0,0,0]` for no emission. An array, which r3f applies with
   * `Color.fromArray`: a hex number goes through `Color.setHex(hex, SRGBColorSpace)`,
   * which decodes these linear values again. The albedo colour is an array too.
   */
  emissive: [number, number, number];
  emissiveIntensity: number;
  /** `emission_energy_multiplier`, floored at zero: the strength of an ADD texture's own term. */
  emissionEnergy: number;
}

/**
 * The authored colour and energy as a linear colour plus an intensity. It stays apart
 * from `resolveEmission`, since the inline path learns whether a texture landed only
 * in the component.
 */
export function emissionScalars(color: Rgba | undefined, energy: number, enabled = true): EmissionScalars {
  if (!enabled) return { emissive: [0, 0, 0], emissiveIntensity: 0, emissionEnergy: 0 };
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
      ? [Math.max(0, linear[0] / peak), Math.max(0, linear[1] / peak), Math.max(0, linear[2] / peak)]
      : [0, 0, 0],
    emissiveIntensity: Math.max(0, energy * peak),
    emissionEnergy: Math.max(0, energy),
  };
}

/** The emission a three material draws: three's colour and intensity, and an ADD texture's term. */
export interface ResolvedEmission {
  emissive: [number, number, number];
  emissiveIntensity: number;
  /**
   * The energy an ADD texture's texel adds at, as `(emission.rgb + emission_tex) * emission_energy`
   * (`scene/resources/material.cpp:1788`). Null when the texture multiplies or there is none.
   */
  addedTextureEnergy: number | null;
}

/**
 * The colour and texture combined the way `emission_operator` says. `hint_default_black` on the
 * sampler zeroes MULTIPLY without a texture (`material.cpp:1066`, `:1792`).
 */
export function resolveEmission(
  { emissive, emissiveIntensity, emissionEnergy }: EmissionScalars,
  operator: number | undefined,
  hasEmissiveMap: boolean
): ResolvedEmission {
  // With a texture this is three's own `emissive * tex * intensity`. Without one it is
  // `emission * 0 * energy`, a Godot content trap reproduced: no emission at all.
  if (operator === EmissionOperator.MULTIPLY) {
    return hasEmissiveMap
      ? { emissive, emissiveIntensity, addedTextureEnergy: null }
      : { emissive: [0, 0, 0], emissiveIntensity: 0, addedTextureEnergy: null };
  }
  return { emissive, emissiveIntensity, addedTextureEnergy: hasEmissiveMap ? emissionEnergy : null };
}
