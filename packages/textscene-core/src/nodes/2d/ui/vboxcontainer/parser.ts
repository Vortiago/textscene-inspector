/**
 * VBoxContainer parser. Adds no fields beyond Control — its vertical stacking
 * and `theme_override_constants/separation` are handled by the Component +
 * the base Control parser's theme-override collection.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

export function parseVBoxContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): ControlProperties {
  return parseControl(heading, properties);
}
