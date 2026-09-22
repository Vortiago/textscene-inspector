/**
 * ColorPickerButton parser — Button's own parse, plus the `color` swatch.
 *
 * `edit_alpha`/`edit_intensity` are deliberately NOT read here: both only
 * affect the internal `ColorPicker` popup (`color_picker.cpp:2519-2520`),
 * which is a `Window` this previewer never draws (`ColorPickerButton::
 * _update_picker`, `color_picker.cpp:2505-2524`).
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseButton } from '../button/parser';
import type { ColorPickerButtonProperties } from './types';

/** `Color color;` (`color_picker.h:513`) — the base `Color()` constructor, opaque black. */
const DEFAULT_COLOR = 'Color(0, 0, 0, 1)';

export function parseColorPickerButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): ColorPickerButtonProperties {
  const result: ColorPickerButtonProperties = { ...parseButton(heading, properties) };
  result.color = properties.color || DEFAULT_COLOR;
  return result;
}
