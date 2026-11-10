/** DampedSpringJoint2D parser: the Node2D parse, and the `length` its marker draws. */

import type { ParsedHeading } from '../../../../parser/utils';
import { floatOr } from '../../../../parser/valueParsers';
import { parseNode2D } from '../../../base/node2d/parser';
import type { DampedSpringJoint2DProperties } from './types';

export function parseDampedSpringJoint2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): DampedSpringJoint2DProperties {
  return { ...parseNode2D(heading, properties), length: floatOr(properties.length, 50) };
}
