/**
 * ColorPickerButton parser: the Button parse plus the `color` swatch.
 * `edit_alpha` and `edit_intensity` stay unread: they change only the popup
 * ColorPicker (`color_picker.cpp:2519-2520`, `color_picker.cpp:2505-2524`), a `Window` that never draws here.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseButton } from '../button/parser';
import type { ColorPickerButtonProperties } from './types';

/** `Color color;` (`color_picker.h:513`): `Color()`, opaque black. */
const DEFAULT_COLOR = 'Color(0, 0, 0, 1)';

export function parseColorPickerButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): ColorPickerButtonProperties {
  const result: ColorPickerButtonProperties = { ...parseButton(heading, properties) };
  result.color = properties.color || DEFAULT_COLOR;
  return result;
}
