/**
 * PointLight2D parser — Node2D transform + the light-specific surface
 * (enabled, color, energy, blend mode, texture, texture scale, offset).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { floatOr, boolOr, enumOr, intOr, vec2Or } from '../../../parser/valueParsers';
import { colorOr } from '../../../utils/colorParser';
import type {
  PointLight2DProperties,
  PointLight2DBlendMode,
  PointLight2DShadowFilter,
} from './types';

export function parsePointLight2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): PointLight2DProperties {
  const base = parseNode2D(heading, properties);

  const result: PointLight2DProperties = {
    ...base,
    enabled: boolOr(properties.enabled, true, 'PointLight2D'),
    color: colorOr(properties.color, { r: 1, g: 1, b: 1, a: 1 }),
    energy: floatOr(properties.energy, 1.0, 'PointLight2D'),
    blend_mode: enumOr(properties.blend_mode, 0 as PointLight2DBlendMode, [0, 1, 2] as const, 'PointLight2D'),
    texture_scale: floatOr(properties.texture_scale, 1.0, 'PointLight2D'),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, 'PointLight2D'),
    // Both default to 1, so a light with nothing authored reaches exactly the
    // items that also left `light_mask` alone.
    range_item_cull_mask: intOr(properties.range_item_cull_mask, 1, 'PointLight2D'),
    shadow_item_cull_mask: intOr(properties.shadow_item_cull_mask, 1, 'PointLight2D'),
    shadow_enabled: boolOr(properties.shadow_enabled, false, 'PointLight2D'),
    // Transparent black: Godot subtracts nothing extra where a shadow falls, it
    // simply withholds the light, so the surface keeps its unlit colour.
    shadow_color: colorOr(properties.shadow_color, { r: 0, g: 0, b: 0, a: 0 }),
    shadow_filter: enumOr(
      properties.shadow_filter,
      0 as PointLight2DShadowFilter,
      [0, 1, 2] as const,
      'PointLight2D'
    ),
    shadow_filter_smooth: floatOr(properties.shadow_filter_smooth, 0.0, 'PointLight2D'),
  };

  if (properties.texture) result.texture = properties.texture;

  return result;
}
