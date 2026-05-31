/**
 * Panel parser. Adds no fields beyond Control — its StyleBox background comes
 * from `theme_override_styles/panel`, collected by the base Control parser's
 * theme-override handling.
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

export function isPanel(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Panel';
}
