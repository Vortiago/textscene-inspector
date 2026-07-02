/**
 * Shared parsing utilities for light nodes.
 */

import type { BaseLightProperties, BaseLightWithNormalBias } from './types';

/**
 * Parses common light properties shared across all light types.
 *
 * Extracts base properties like color, energy, and shadow settings
 * that are common to DirectionalLight3D, OmniLight3D, and SpotLight3D.
 */
export function parseBaseLightProperties(
  properties: Record<string, string>
): BaseLightProperties {
  return {
    light_color: properties.light_color || 'Color(1, 1, 1, 1)',
    light_energy: properties.light_energy ? parseFloat(properties.light_energy) : 1.0,
    light_negative:
      properties.light_negative !== undefined ? properties.light_negative === 'true' : undefined,
    light_specular: properties.light_specular
      ? parseFloat(properties.light_specular)
      : undefined,
    light_volumetric_fog_energy: properties.light_volumetric_fog_energy
      ? parseFloat(properties.light_volumetric_fog_energy)
      : undefined,
    shadow_enabled: properties.shadow_enabled === 'true',
    shadow_bias: properties.shadow_bias ? parseFloat(properties.shadow_bias) : undefined,
    shadow_blur: properties.shadow_blur ? parseFloat(properties.shadow_blur) : undefined,
  };
}

/**
 * Parses light properties including shadow_normal_bias.
 *
 * Used by DirectionalLight3D and OmniLight3D which support normal bias
 * for shadow artifact reduction.
 */
export function parseBaseLightWithNormalBias(
  properties: Record<string, string>
): BaseLightWithNormalBias {
  return {
    ...parseBaseLightProperties(properties),
    shadow_normal_bias: properties.shadow_normal_bias
      ? parseFloat(properties.shadow_normal_bias)
      : undefined,
  };
}
