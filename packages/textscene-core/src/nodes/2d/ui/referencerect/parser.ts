/** ReferenceRect parser — Control + a design-time border outline. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ReferenceRectProperties } from './types';
import { parseControl } from '../control/parser';
import { floatOr, boolOr } from '../../../../parser/valueParsers';

const CONTEXT = 'ReferenceRect';

/** `reference_rect.h:33` — `Color border_color = Color(1, 0, 0)`. */
const DEFAULT_BORDER_COLOR = 'Color(1, 0, 0, 1)';
/** `reference_rect.h:34` — `float border_width = 1.0`. */
const DEFAULT_BORDER_WIDTH = 1.0;
/** `reference_rect.h:35` — `bool editor_only = true`. */
const DEFAULT_EDITOR_ONLY = true;

export function parseReferenceRect(
  heading: ParsedHeading,
  properties: Record<string, string>
): ReferenceRectProperties {
  const result: ReferenceRectProperties = { ...parseControl(heading, properties) };
  result.borderColor = properties.border_color || DEFAULT_BORDER_COLOR;
  // set_border_width (reference_rect.cpp:61-69) always stores MAX(0.0, p_width) —
  // a negative literal never reaches the render, so it is clamped here too.
  result.borderWidth = Math.max(0, floatOr(properties.border_width, DEFAULT_BORDER_WIDTH, CONTEXT));
  result.editorOnly = boolOr(properties.editor_only, DEFAULT_EDITOR_ONLY, CONTEXT);
  return result;
}
