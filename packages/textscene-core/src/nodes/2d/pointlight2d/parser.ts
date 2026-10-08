/** Parses a PointLight2D: the Light2D surface plus its cookie texture. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseLight2D } from '../lights/shared/parser';
import { floatOr, vec2Or } from '../../../parser/valueParsers';
import type { PointLight2DProperties } from './types';

export function parsePointLight2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): PointLight2DProperties {
  const result: PointLight2DProperties = {
    ...parseLight2D(heading, properties),
    texture_scale: floatOr(properties.texture_scale, 1.0, 'PointLight2D'),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, 'PointLight2D'),
  };

  if (properties.texture) result.texture = properties.texture;

  return result;
}
