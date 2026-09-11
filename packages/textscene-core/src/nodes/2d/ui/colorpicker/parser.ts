/**
 * ColorPicker parser — VBoxContainer's own parse, plus `color` and
 * `picker_shape`: the two properties this previewer's painter reads. Every
 * other ColorPicker-own property (`edit_alpha`, `color_mode`,
 * `can_add_swatches`, `sampler_visible`, `color_modes_visible`,
 * `sliders_visible`, `hex_visible`, `presets_visible`, `deferred_mode`)
 * toggles a row this previewer does not draw (`Component.tsx`'s own doc), so
 * none of them changes a single pixel here.
 */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import { parseVBoxContainer } from '../vboxcontainer/parser';
import type { ColorPickerProperties } from './types';

/** `Color color;` (`color_picker.h:274`) — the base `Color()` constructor, opaque black. */
const DEFAULT_COLOR = 'Color(0, 0, 0, 1)';

export function parseColorPicker(
  heading: ParsedHeading,
  properties: Record<string, string>
): ColorPickerProperties {
  const result: ColorPickerProperties = { ...parseVBoxContainer(heading, properties) };
  result.color = properties.color || DEFAULT_COLOR;
  result.pickerShape = parseOptionalInt(properties.picker_shape);
  return result;
}
