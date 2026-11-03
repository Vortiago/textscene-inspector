/** Parses a PointLight2D: the Light2D surface plus its height and its cookie texture. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseLight2D } from '../lights/shared/parser';
import { floatOr, vec2Or } from '../../../parser/valueParsers';
import { holdsResource } from '../../../godot/scene/resourceLiteral.js';
import type { PointLight2DProperties } from './types';

export function parsePointLight2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): PointLight2DProperties {
  const result: PointLight2DProperties = {
    ...parseLight2D(heading, properties),
    // `Light2D::height` initialises to 0 (`light_2d.h:59`).
    height: floatOr(properties.height, 0, 'PointLight2D'),
    texture_scale: floatOr(properties.texture_scale, 1.0, 'PointLight2D'),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, 'PointLight2D'),
  };

  if (holdsResource(properties.texture)) result.texture = properties.texture;

  return result;
}
