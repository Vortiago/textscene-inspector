/**
 * Shared parsing utilities for light nodes.
 */

import type { BaseLightProperties, BaseLightWithNormalBias } from './types';
import { floatOr, parseOptionalFloat } from '../../../../parser/valueParsers';

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
    light_energy: floatOr(properties.light_energy, 1.0, 'light_energy'),
    light_negative:
      properties.light_negative !== undefined ? properties.light_negative === 'true' : undefined,
    light_specular: parseOptionalFloat(properties.light_specular),
    light_volumetric_fog_energy: parseOptionalFloat(properties.light_volumetric_fog_energy),
    shadow_enabled: properties.shadow_enabled === 'true',
    shadow_bias: parseOptionalFloat(properties.shadow_bias),
    shadow_blur: parseOptionalFloat(properties.shadow_blur),
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
    shadow_normal_bias: parseOptionalFloat(properties.shadow_normal_bias),
  };
}
