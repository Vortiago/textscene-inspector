/** ColorRect parser: the Control parse plus a solid fill colour. */

/** The Godot default of `color` (class_colorrect). Godot omits a property at its default, so an absent `color` is opaque white. */
const DEFAULT_COLOR = 'Color(1, 1, 1, 1)';

import type { ParsedHeading } from '../../../../parser/utils';
import type { ColorRectProperties } from './types';
import { parseControl } from '../control/parser';

export function parseColorRect(
  heading: ParsedHeading,
  properties: Record<string, string>
): ColorRectProperties {
  const result: ColorRectProperties = { ...parseControl(heading, properties) };
  result.color = properties.color || DEFAULT_COLOR;
  return result;
}
