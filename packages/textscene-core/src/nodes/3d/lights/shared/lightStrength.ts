/**
 * A light's three intensity, shadow intensity, specular amount and fog energy, from its Godot
 * energy, sign, shadow opacity, `light_specular` and `light_volumetric_fog_energy`.
 */

import {
  DIRECTIONAL_LIGHT_SPECULAR_DEFAULT,
  LIGHT_SHADOW_OPACITY_DEFAULT,
  LIGHT_SPECULAR_DEFAULT,
} from '../../../../godot/scene/light';
import { LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT } from '../../../../godot/rendering/environment/volumetricFog';
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

/** An omni or spot light's `specular_amount`: twice its `light_specular` (`light_storage.cpp:891`). */
export function positionalLightSpecularAmount(
  properties: Pick<BaseLightProperties, 'light_specular'>
): number {
  return (properties.light_specular ?? LIGHT_SPECULAR_DEFAULT) * 2;
}

/** A directional light's specular amount: its `light_specular` itself (`light_storage.cpp:665`). */
export function directionalLightSpecularAmount(
  properties: Pick<BaseLightProperties, 'light_specular'>
): number {
  return properties.light_specular ?? DIRECTIONAL_LIGHT_SPECULAR_DEFAULT;
}

/** How strongly the light scatters into volumetric fog: its `light_volumetric_fog_energy`. */
export function lightFogEnergy(properties: Pick<BaseLightProperties, 'light_volumetric_fog_energy'>): number {
  return properties.light_volumetric_fog_energy ?? LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT;
}
