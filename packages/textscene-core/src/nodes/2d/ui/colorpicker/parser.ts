/**
 * ColorPicker parser: the VBoxContainer parse plus every ColorPicker property
 * that changes a drawn row. `can_add_swatches` and `deferred_mode` stay unread
 * (`linterParserAllowlist`).
 */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalInt, parseOptionalBool } from '../../../../parser/valueParsers';
import { parseVBoxContainer } from '../vboxcontainer/parser';
import type { ColorPickerProperties } from './types';

/**
 * `Color color;` (`color_picker.h:274`) defaults to opaque black, but the
 * constructor calls `set_pick_color(Color(1, 1, 1))` (`color_picker.cpp:2289`)
 * before the loader sees the node, so an omitted `color` means opaque white.
 */
const DEFAULT_COLOR = 'Color(1, 1, 1, 1)';

export function parseColorPicker(
  heading: ParsedHeading,
  properties: Record<string, string>
): ColorPickerProperties {
  const result: ColorPickerProperties = { ...parseVBoxContainer(heading, properties) };
  result.color = properties.color || DEFAULT_COLOR;
  result.pickerShape = parseOptionalInt(properties.picker_shape);
  result.colorMode = parseOptionalInt(properties.color_mode);
  result.colorModesVisible = parseOptionalBool(properties.color_modes_visible);
  result.slidersVisible = parseOptionalBool(properties.sliders_visible);
  result.hexVisible = parseOptionalBool(properties.hex_visible);
  result.presetsVisible = parseOptionalBool(properties.presets_visible);
  result.samplerVisible = parseOptionalBool(properties.sampler_visible);
  result.editAlpha = parseOptionalBool(properties.edit_alpha);
  result.editIntensity = parseOptionalBool(properties.edit_intensity);
  return result;
}
