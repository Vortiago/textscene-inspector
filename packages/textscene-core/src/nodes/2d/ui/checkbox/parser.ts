/** CheckBox parser: Button's parse plus `button_pressed` and `button_group`. A CheckBox is a Button (`check_box.h:35`). */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseButton } from '../button/parser';
import type { CheckBoxProperties } from './types';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';

export function parseCheckBox(
  heading: ParsedHeading,
  properties: Record<string, string>
): CheckBoxProperties {
  const result: CheckBoxProperties = { ...parseButton(heading, properties) };
  result.buttonPressed = boolSlotValue(properties.button_pressed) === true;
  if (properties.button_group !== undefined) result.buttonGroup = properties.button_group;
  return result;
}
