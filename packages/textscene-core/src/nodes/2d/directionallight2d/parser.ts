/** Parses a DirectionalLight2D: the Light2D surface plus `height` and `max_distance`. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseLight2D } from '../lights/shared/parser';
import { floatOr } from '../../../parser/valueParsers';
import type { DirectionalLight2DProperties } from './types';

/** `DirectionalLight2D::max_distance`'s initialiser (`scene/2d/light_2d.h:188`). */
const MAX_DISTANCE_DEFAULT = 10000;

export function parseDirectionalLight2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): DirectionalLight2DProperties {
  return {
    ...parseLight2D(heading, properties),
    // `Light2D::height` initialises to 0 (`light_2d.h:59`).
    height: floatOr(properties.height, 0, 'DirectionalLight2D'),
    max_distance: floatOr(properties.max_distance, MAX_DISTANCE_DEFAULT, 'DirectionalLight2D'),
  };
}
