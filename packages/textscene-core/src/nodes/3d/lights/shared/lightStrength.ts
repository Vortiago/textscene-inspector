/** A light's three intensity and shadow intensity, from its Godot energy, sign and shadow opacity. */

import { LIGHT_SHADOW_OPACITY_DEFAULT } from '../../../../godot/light';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import type { BaseLightProperties } from './types';

/** `light_energy` with the sign of `light_negative`, as Godot's light buffer holds it (`light_storage.cpp:646`). */
export function signedLightEnergy(
  properties: Pick<BaseLightProperties, 'light_energy' | 'light_negative'>
): number {
  return properties.light_negative === true ? -properties.light_energy : properties.light_energy;
}

/** three's intensity: a negative light subtracts, in three as in Godot. */
export function lightIntensity(
  properties: Pick<BaseLightProperties, 'light_energy' | 'light_negative'>
): number {
  return signedLightEnergy(properties) * LIGHT_INTENSITY_SCALE;
}

/** three's `shadow.intensity` mixes towards unshadowed as Godot's `shadow_opacity` does (`scene_forward_lights_inc.glsl:577`). */
export function lightShadowOpacity(properties: Pick<BaseLightProperties, 'shadow_opacity'>): number {
  return properties.shadow_opacity ?? LIGHT_SHADOW_OPACITY_DEFAULT;
}
