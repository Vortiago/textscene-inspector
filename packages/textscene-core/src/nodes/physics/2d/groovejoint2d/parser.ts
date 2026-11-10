/** GrooveJoint2D parser: the Node2D parse, and the `length` and `initial_offset` its marker draws. */

import type { ParsedHeading } from '../../../../parser/utils';
import { floatOr } from '../../../../parser/valueParsers';
import { parseNode2D } from '../../../base/node2d/parser';
import { parseJointLength } from '../shared/jointLength';
import type { GrooveJoint2DProperties } from './types';

export function parseGrooveJoint2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): GrooveJoint2DProperties {
  return {
    ...parseNode2D(heading, properties),
    length: parseJointLength(properties.length),
    initial_offset: floatOr(properties.initial_offset, 25),
  };
}
