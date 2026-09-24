/**
 * Parses a MarginContainer. It adds no fields to Control: its padding comes from
 * `theme_override_constants/margin_{left,top,right,bottom}`, which the Control parser collects.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

export function parseMarginContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): ControlProperties {
  return parseControl(heading, properties);
}
