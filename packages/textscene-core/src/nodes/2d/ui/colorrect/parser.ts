/** ColorRect parser — Control + a solid fill color. */

/**
 * Godot's own default (class_colorrect): `color = Color(1, 1, 1, 1)`. Godot
 * omits a property at its default, so an absent `color` means opaque WHITE —
 * defaulting to "no fill" renders a ColorRect that Godot fills as invisible.
 */
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
