/**
 * LightOccluder2D parser — Node2D plus the occluder polygon reference and mask props.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { intOr, boolOr } from '../../../parser/valueParsers';
import type { LightOccluder2DProperties } from './types';

export function parseLightOccluder2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): LightOccluder2DProperties {
  const baseProperties = parseNode2D(heading, properties);
  return {
    ...baseProperties,
    occluder: properties.occluder ?? undefined,
    light_mask: intOr(properties.light_mask, 1, 'LightOccluder2D.light_mask'),
    sdf_collision: boolOr(properties.sdf_collision, true, 'LightOccluder2D.sdf_collision'),
    occluder_light_mask: intOr(properties.occluder_light_mask, 1, 'LightOccluder2D.occluder_light_mask'),
  };
}
