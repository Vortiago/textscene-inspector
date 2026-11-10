/** GrooveJoint2D parser: the spring joint's parse, and the `initial_offset` its marker draws. */

import type { ParsedHeading } from '../../../../parser/utils';
import { floatOr } from '../../../../parser/valueParsers';
import { parseDampedSpringJoint2D } from '../dampedspringjoint2d/parser';
import type { GrooveJoint2DProperties } from './types';

export function parseGrooveJoint2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): GrooveJoint2DProperties {
  return {
    ...parseDampedSpringJoint2D(heading, properties),
    initial_offset: floatOr(properties.initial_offset, 25),
  };
}
