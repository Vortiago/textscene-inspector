/**
 * Parses a MenuButton as a Button with `flat` and `toggle_mode` defaulting to true. `MenuButton::MenuButton()`
 * calls `set_flat(true)` (`menu_button.cpp:264`) and `set_toggle_mode(true)` (`:240`), default overrides
 * (`doc/classes/MenuButton.xml`), so an absent key means true.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { MenuButtonProperties } from './types';
import { parseButton, parseButtonPressed } from '../button/parser';

export function parseMenuButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): MenuButtonProperties {
  const result = parseButton(heading, properties);
  if (properties.flat === undefined) result.flat = true;
  result.buttonPressed = parseButtonPressed(properties, true);
  return result;
}
