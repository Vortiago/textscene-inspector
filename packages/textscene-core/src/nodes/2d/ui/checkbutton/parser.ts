/** CheckButton parser: Button's parse plus `button_pressed`. check_button.cpp binds no property, and its constructor only sets toggle_mode=true. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseToggleButton } from '../button/parser';
import type { CheckButtonProperties } from './types';

export function parseCheckButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): CheckButtonProperties {
  const result: CheckButtonProperties = { ...parseToggleButton(heading, properties) };
  return result;
}
