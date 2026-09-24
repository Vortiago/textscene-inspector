/**
 * Parses a Path2D: the Node2D surface plus the raw `curve` reference, which the
 * component resolves and tessellates.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import type { Path2DProperties } from './types';

export function parsePath2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Path2DProperties {
  const base = parseNode2D(heading, properties);
  const result: Path2DProperties = { ...base };
  if (properties.curve) result.curve = properties.curve;
  return result;
}
