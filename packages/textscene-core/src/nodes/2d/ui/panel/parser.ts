/**
 * Parses a Panel. It adds no fields beyond Control: the base Control parser
 * collects its `theme_override_styles/panel` StyleBox.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

export function parsePanel(
  heading: ParsedHeading,
  properties: Record<string, string>
): ControlProperties {
  return parseControl(heading, properties);
}
