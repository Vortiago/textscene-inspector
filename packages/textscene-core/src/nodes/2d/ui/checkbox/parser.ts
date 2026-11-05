/** CheckBox parser: Control plus text, the checked and disabled flags, `alignment` and `clip_text`. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { CheckBoxProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';

export function parseCheckBox(
  heading: ParsedHeading,
  properties: Record<string, string>
): CheckBoxProperties {
  const result: CheckBoxProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.buttonPressed = boolSlotValue(properties.button_pressed) === true;
  result.disabled = boolSlotValue(properties.disabled) === true;
  result.alignment = parseOptionalInt(properties.alignment);
  if (boolSlotValue(properties.clip_text) === true) result.clipText = true;
  if (properties.button_group !== undefined) result.buttonGroup = properties.button_group;
  return result;
}
