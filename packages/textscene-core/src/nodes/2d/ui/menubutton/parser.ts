/**
 * MenuButton parser — Button's, with `flat` defaulting to true.
 *
 * `MenuButton::MenuButton()` calls `set_flat(true)` (`menu_button.cpp:264`) —
 * a class-default OVERRIDE of Button's own `flat=false`, not a new property
 * (`doc/classes/MenuButton.xml`'s `flat` carries `overrides="Button"`). A
 * `.tscn` only ever WRITES `flat` when it differs from that default, so an
 * absent key means true here, not Button's own false.
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
