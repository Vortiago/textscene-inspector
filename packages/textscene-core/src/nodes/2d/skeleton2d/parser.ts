/** Parses a Skeleton2D: the Node2D surface and the reference to its modification stack. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import type { Skeleton2DProperties } from './types';

export function parseSkeleton2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Skeleton2DProperties {
  return { ...parseNode2D(heading, properties), modificationStack: properties.modification_stack };
}
