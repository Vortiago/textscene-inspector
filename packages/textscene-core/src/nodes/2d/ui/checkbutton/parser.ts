/** CheckButton parser — Button's own parse, plus `button_pressed` (check_button.cpp binds none of its own; it sets toggle_mode=true in its constructor without re-declaring the property). */

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
