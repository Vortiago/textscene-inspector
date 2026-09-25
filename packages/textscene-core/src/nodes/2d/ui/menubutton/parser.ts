/**
 * Parses a MenuButton as a Button with `flat` defaulting to true. `MenuButton::MenuButton()` calls
 * `set_flat(true)` (`menu_button.cpp:264`), a default override (`doc/classes/MenuButton.xml`), so an
 * absent `flat` means true.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { MenuButtonProperties } from './types';
import { parseButton } from '../button/parser';

export function parseMenuButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): MenuButtonProperties {
  const result = parseButton(heading, properties);
  if (properties.flat === undefined) result.flat = true;
  return result;
}
