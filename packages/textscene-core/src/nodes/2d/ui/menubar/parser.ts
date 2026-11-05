/** Parses a MenuBar: Control plus `flat` and the direction and language of its titles. */

import { type ParsedHeading } from '../../../../parser/utils';
import type { MenuBarProperties } from './types';
import { parseControl } from '../control/parser';
import { parseTextDirectionProperties } from '../../../../parser/textDirectionParser';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';

export function parseMenuBar(heading: ParsedHeading, properties: Record<string, string>): MenuBarProperties {
  const result: MenuBarProperties = {
    ...parseControl(heading, properties),
    ...parseTextDirectionProperties(properties, 'MenuBar'),
  };
  result.flat = boolSlotValue(properties.flat) === true;
  return result;
}
