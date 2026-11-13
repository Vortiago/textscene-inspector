/** DampedSpringJoint2D parser: the Node2D parse, and the `length` its marker draws. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode2D } from '../../../base/node2d/parser';
import { parseJointLength } from '../shared/jointLength';
import type { DampedSpringJoint2DProperties } from './types';

export function parseDampedSpringJoint2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): DampedSpringJoint2DProperties {
  return { ...parseNode2D(heading, properties), length: parseJointLength(properties.length) };
}
