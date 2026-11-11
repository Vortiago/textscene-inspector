/** Button parser: Control plus text, the disabled and flat flags, and alignment. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import { parseTextDirectionProperties } from '../../../../parser/textDirectionParser';
import type { ButtonProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';

/**
 * Whether `button_pressed` is on: `BaseButton::set_pressed` refuses a button that is no toggle. `isToggleByDefault`
 * is the class's `toggle_mode` default: true for OptionButton (`option_button.cpp:652`) and MenuButton (`menu_button.cpp:240`).
 */
function parseButtonPressed(properties: Record<string, string>, isToggleByDefault: boolean): boolean {
  const isToggle = boolSlotValue(properties.toggle_mode) ?? isToggleByDefault;
  return isToggle === true && boolSlotValue(properties.button_pressed) === true;
}

/** Parses a Button, whose `toggle_mode` defaults to false. */
export function parseButton(heading: ParsedHeading, properties: Record<string, string>): ButtonProperties {
  return parseButtonWithToggleDefault(heading, properties, false);
}

/** Parses a Button subclass whose constructor sets `toggle_mode`: CheckBox, CheckButton, OptionButton and MenuButton. */
export function parseToggleButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): ButtonProperties {
  return parseButtonWithToggleDefault(heading, properties, true);
}

function parseButtonWithToggleDefault(
  heading: ParsedHeading,
  properties: Record<string, string>,
  isToggleByDefault: boolean
): ButtonProperties {
  const result: ButtonProperties = {
    ...parseControl(heading, properties),
    ...parseTextDirectionProperties(properties, heading.attributes.type ?? 'Button'),
  };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.disabled = boolSlotValue(properties.disabled) === true;
  result.flat = boolSlotValue(properties.flat) === true;
  result.buttonPressed = parseButtonPressed(properties, isToggleByDefault);
  result.alignment = parseOptionalInt(properties.alignment);
  // class_button.html: icon_alignment 0 (LEFT), vertical_icon_alignment 1
  // (CENTER), expand_icon false. An icon-only button carries no text.
  if (properties.icon !== undefined) result.icon = properties.icon;
  result.iconAlignment = parseOptionalInt(properties.icon_alignment);
  result.verticalIconAlignment = parseOptionalInt(properties.vertical_icon_alignment);
  result.expandIcon = boolSlotValue(properties.expand_icon) === true;
  result.overrunBehavior = parseOptionalInt(properties.text_overrun_behavior);
  if (boolSlotValue(properties.clip_text) === true) result.clipText = true;
  result.autowrapMode = parseOptionalInt(properties.autowrap_mode);
  result.autowrapTrimFlags = parseOptionalInt(properties.autowrap_trim_flags, 'int64');
  return result;
}
