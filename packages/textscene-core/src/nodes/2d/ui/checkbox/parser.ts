/** CheckBox parser — Control + text + checked/disabled flags. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import type { CheckBoxProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue } from '../../../../godot/index.js';

export function parseCheckBox(
  heading: ParsedHeading,
  properties: Record<string, string>
): CheckBoxProperties {
  const result: CheckBoxProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.buttonPressed = boolSlotValue(properties.button_pressed) === true;
  result.disabled = boolSlotValue(properties.disabled) === true;
  if (properties.button_group !== undefined) result.buttonGroup = properties.button_group;
  return result;
}
