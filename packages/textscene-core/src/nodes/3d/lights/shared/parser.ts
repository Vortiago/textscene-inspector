/** Parsing shared by the light nodes. */

import type { BaseLightProperties, BaseLightWithNormalBias } from './types';
import { floatOr, parseOptionalFloat } from '../../../../parser/valueParsers';
import { boolSlotValue } from '../../../../godot/index.js';

/** The colour, energy and shadow properties every light type shares. */
export function parseBaseLightProperties(
  properties: Record<string, string>
): BaseLightProperties {
  return {
    light_color: properties.light_color || 'Color(1, 1, 1, 1)',
    light_energy: floatOr(properties.light_energy, 1.0, 'light_energy'),
    light_negative:
      properties.light_negative !== undefined ? boolSlotValue(properties.light_negative) === true : undefined,
    light_specular: parseOptionalFloat(properties.light_specular),
    light_volumetric_fog_energy: parseOptionalFloat(properties.light_volumetric_fog_energy),
    shadow_enabled: boolSlotValue(properties.shadow_enabled) === true,
    shadow_bias: parseOptionalFloat(properties.shadow_bias),
    shadow_blur: parseOptionalFloat(properties.shadow_blur),
  };
}

/** The shared properties plus shadow_normal_bias, for DirectionalLight3D and OmniLight3D. */
export function parseBaseLightWithNormalBias(
  properties: Record<string, string>
): BaseLightWithNormalBias {
  return {
    ...parseBaseLightProperties(properties),
    shadow_normal_bias: parseOptionalFloat(properties.shadow_normal_bias),
  };
}
