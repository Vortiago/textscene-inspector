/**
 * The one number a positional shadow hands its lookup for its soft shadow, which three uploads as
 * `shadowRadius`. Godot's lookups read the penumbra's size only times its scale
 * (`scene_forward_lights_inc.glsl:513-514`, `:800`), so one signed number carries both paths.
 */

import type { PositionalSoftShadow } from '../../godot/positionalShadow.js';

/**
 * The PCF kernel's radius, `soft_shadow_scale`, or minus the penumbra's spread,
 * `soft_shadow_size * soft_shadow_scale`, for a light that searches for blockers. Never negative
 * for PCF, as a light with a size and no blur filters (`positionalSoftShadow`).
 */
export function softShadowRadius({ size, scale }: PositionalSoftShadow): number {
  return size > 0 ? -size * scale : scale;
}
