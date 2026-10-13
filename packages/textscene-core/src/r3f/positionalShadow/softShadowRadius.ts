/**
 * The one number a positional shadow hands its lookup for its soft shadow, which three uploads as
 * `shadowRadius`. Godot's lookups read the penumbra's size only times its scale
 * (`scene_forward_lights_inc.glsl:513-514`, `:800`), so one signed number carries both paths. A
 * negative one also asks every lit program to compile the search (`../shadowFilter/softShadowSearch.ts`).
 */

import type { PositionalSoftShadow } from '../../godot/positionalShadow.js';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { readPositionalShadowDeclaration } from './declaration.js';

/**
 * The PCF kernel's radius, `soft_shadow_scale`, or minus the penumbra's spread,
 * `soft_shadow_size * soft_shadow_scale`, for a light that searches for blockers. Never negative
 * for PCF, as a light with a size and no blur filters (`positionalSoftShadow`).
 */
export function softShadowRadius({ size, scale }: PositionalSoftShadow): number {
  return size > 0 ? -size * scale : scale;
}

/**
 * Whether a casting omni, spot or area light among `lights` searches for blockers, which Godot's
 * `sc_use_light_soft_shadows` turns on (`renderer_scene_cull.cpp:1786`, `:3055`). A hidden light
 * counts, so hiding one compiles no material again.
 */
export function searchesPositionalBlockers(lights: readonly SceneLight[]): boolean {
  return lights.some(({ light }) => {
    if (!light.castShadow) return false;
    const radius = readPositionalShadowDeclaration(light)?.softShadowRadius;
    return radius !== undefined && radius < 0;
  });
}
