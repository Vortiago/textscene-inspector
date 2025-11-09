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
    shadow_enabled: properties.shadow_enabled === 'true',
    shadow_bias: properties.shadow_bias ? parseFloat(properties.shadow_bias) : undefined,
    shadow_filter: properties.shadow_filter ? parseInt(properties.shadow_filter, 10) : undefined,
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
