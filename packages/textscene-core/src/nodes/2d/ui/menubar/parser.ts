/** Parses a MenuBar: Control plus `flat`, its one property that changes what draws. */

import { type ParsedHeading } from '../../../../parser/utils';
import type { MenuBarProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue } from '../../../../godot/index.js';

export function parseMenuBar(
  heading: ParsedHeading,
  properties: Record<string, string>
): MenuBarProperties {
  const result: MenuBarProperties = { ...parseControl(heading, properties) };
  result.flat = boolSlotValue(properties.flat) === true;
  return result;
}
