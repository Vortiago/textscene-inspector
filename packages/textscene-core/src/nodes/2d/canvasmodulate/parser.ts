/**
 * CanvasModulate parser: the Node2D transform and modulate, and `color`. An omitted
 * `color` falls back to white through `parseColor(undefined)`.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseColor } from '../../../utils/colorParser';
import type { CanvasModulateProperties } from './types';

export function parseCanvasModulate(
  heading: ParsedHeading,
  properties: Record<string, string>
): CanvasModulateProperties {
  const base = parseNode2D(heading, properties);
  return {
    ...base,
    color: parseColor(properties.color),
  };
}
