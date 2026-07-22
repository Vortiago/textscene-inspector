/** Label parser — Control + text + alignment. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { LabelProperties } from './types';
import { parseControl } from '../control/parser';

/**
 * Godot's `Label` constructor calls `set_v_size_flags(SIZE_SHRINK_CENTER)`, so
 * a Label in a box container shrinks to its text height and centres on the
 * cross axis rather than filling it (which would pin its top-aligned text to
 * the top). Base `Control` defaults to `SIZE_FILL`, so this override lives here,
 * only when the scene doesn't set `size_flags_vertical` itself.
 */
const LABEL_DEFAULT_V_SIZE_FLAGS = 4; // SIZE_SHRINK_CENTER

export function parseLabel(
  heading: ParsedHeading,
  properties: Record<string, string>
): LabelProperties {
  const result: LabelProperties = { ...parseControl(heading, properties) };
  if (result.sizeFlagsVertical === undefined) {
    result.sizeFlagsVertical = LABEL_DEFAULT_V_SIZE_FLAGS;
  }
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.horizontalAlignment = parseOptionalInt(properties.horizontal_alignment);
  result.verticalAlignment = parseOptionalInt(properties.vertical_alignment);
  result.autowrapMode = parseOptionalInt(properties.autowrap_mode);
  if (properties.uppercase === 'true') result.uppercase = true;
  return result;
}
