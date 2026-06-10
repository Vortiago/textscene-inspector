/**
 * MarginContainer parser. Adds no fields beyond Control — its padding comes
 * from `theme_override_constants/margin_{left,top,right,bottom}`, collected by
 * the base Control parser's theme-override handling.
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
