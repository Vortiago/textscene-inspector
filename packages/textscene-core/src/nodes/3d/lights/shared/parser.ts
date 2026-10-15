/** Parsing shared by the light nodes. */

import type { BaseLightProperties, BaseLightWithNormalBias, PositionalLightProperties } from './types';
import { floatOr, parseOptionalBool, parseOptionalFloat } from '../../../../parser/valueParsers';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';
import { parseVisualLayers } from '../../visualinstance3d/parser';

/** The colour, energy and shadow properties every light type shares. */
function parseBaseLightProperties(properties: Record<string, string>): BaseLightProperties {
  return {
    layers: parseVisualLayers(properties),
    light_color: properties.light_color || 'Color(1, 1, 1, 1)',
    light_energy: floatOr(properties.light_energy, 1.0, 'light_energy'),
    light_negative: parseOptionalBool(properties.light_negative),
    light_specular: parseOptionalFloat(properties.light_specular),
    light_volumetric_fog_energy: parseOptionalFloat(properties.light_volumetric_fog_energy),
    shadow_enabled: boolSlotValue(properties.shadow_enabled) === true,
    shadow_bias: parseOptionalFloat(properties.shadow_bias),
    shadow_blur: parseOptionalFloat(properties.shadow_blur),
    shadow_opacity: parseOptionalFloat(properties.shadow_opacity),
  };
}

/** The shared properties plus shadow_normal_bias, for the light types whose shadow reads it. */
export function parseBaseLightWithNormalBias(properties: Record<string, string>): BaseLightWithNormalBias {
  return {
    ...parseBaseLightProperties(properties),
    shadow_normal_bias: parseOptionalFloat(properties.shadow_normal_bias),
  };
}

/** The shared properties plus the size and the distance fade, for an omni, spot or area light. */
export function parsePositionalLightProperties(
  properties: Record<string, string>
): PositionalLightProperties {
  return {
    ...parseBaseLightWithNormalBias(properties),
    light_size: parseOptionalFloat(properties.light_size),
    distance_fade_enabled: parseOptionalBool(properties.distance_fade_enabled),
    distance_fade_begin: parseOptionalFloat(properties.distance_fade_begin),
    distance_fade_shadow: parseOptionalFloat(properties.distance_fade_shadow),
    distance_fade_length: parseOptionalFloat(properties.distance_fade_length),
  };
}
