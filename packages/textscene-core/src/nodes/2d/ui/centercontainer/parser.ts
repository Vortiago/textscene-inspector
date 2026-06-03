/**
 * CenterContainer parser. Adds no fields beyond Control — centering its single
 * child is purely a layout concern handled by the Component, so the base
 * Control parser does all the work.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

export function parseCenterContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): ControlProperties {
  return parseControl(heading, properties);
}
