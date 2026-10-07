/** Parses the Light2D surface PointLight2D and DirectionalLight2D share, over the Node2D transform. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode2D } from '../../../base/node2d/parser';
import { floatOr, boolOr, enumOr, intOr } from '../../../../parser/valueParsers';
import { colorOr } from '../../../../utils/colorParser';
import { LIGHT_2D_RANGE_DEFAULTS } from './types';
import type { Light2DProperties, Light2DBlendMode, Light2DShadowFilter } from './types';

export function parseLight2D(heading: ParsedHeading, properties: Record<string, string>): Light2DProperties {
  const context = heading.attributes.type ?? 'Light2D';
  return {
    ...parseNode2D(heading, properties),
    enabled: boolOr(properties.enabled, true, context),
    color: colorOr(properties.color, { r: 1, g: 1, b: 1, a: 1 }),
    energy: floatOr(properties.energy, 1.0, context),
    blend_mode: enumOr(properties.blend_mode, 0 as Light2DBlendMode, [0, 1, 2] as const, context),
    // Both default to 1, so a light with nothing authored reaches exactly the
    // items that also left `light_mask` alone.
    range_item_cull_mask: intOr(
      properties.range_item_cull_mask,
      LIGHT_2D_RANGE_DEFAULTS.itemCullMask,
      context
    ),
    shadow_item_cull_mask: intOr(properties.shadow_item_cull_mask, 1, context),
    // `Light2D::set_z_range_min` and its three siblings assign with no CLAMP and
    // no reordering of the pair, so neither happens here.
    range_z_min: intOr(properties.range_z_min, LIGHT_2D_RANGE_DEFAULTS.zMin, context),
    range_z_max: intOr(properties.range_z_max, LIGHT_2D_RANGE_DEFAULTS.zMax, context),
    range_layer_min: intOr(properties.range_layer_min, LIGHT_2D_RANGE_DEFAULTS.layerMin, context),
    range_layer_max: intOr(properties.range_layer_max, LIGHT_2D_RANGE_DEFAULTS.layerMax, context),
    shadow_enabled: boolOr(properties.shadow_enabled, false, context),
    // Transparent black: Godot subtracts nothing extra where a shadow falls, it
    // simply withholds the light, so the surface keeps its unlit colour.
    shadow_color: colorOr(properties.shadow_color, { r: 0, g: 0, b: 0, a: 0 }),
    shadow_filter: enumOr(properties.shadow_filter, 0 as Light2DShadowFilter, [0, 1, 2] as const, context),
    shadow_filter_smooth: floatOr(properties.shadow_filter_smooth, 0.0, context),
  };
}
