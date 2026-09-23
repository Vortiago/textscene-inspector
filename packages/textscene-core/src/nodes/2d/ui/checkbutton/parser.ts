/** CheckButton parser: Button's parse plus `button_pressed`. check_button.cpp binds no property, and its constructor only sets toggle_mode=true. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseButton } from '../button/parser';
import type { CheckButtonProperties } from './types';
import { boolSlotValue } from '../../../../godot/index.js';

export function parseCheckButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): CheckButtonProperties {
  const result: CheckButtonProperties = { ...parseButton(heading, properties) };
  result.buttonPressed = boolSlotValue(properties.button_pressed) === true;
  return result;
}
