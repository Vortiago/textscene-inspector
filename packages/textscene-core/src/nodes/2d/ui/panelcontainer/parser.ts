/**
 * PanelContainer parser. Adds no fields beyond Control — its StyleBox panel
 * (`theme_override_styles/panel`) and content margins are handled by the
 * Component + the base Control parser's theme-override collection.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

export function parsePanelContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): ControlProperties {
  return parseControl(heading, properties);
}

export function isPanelContainer(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'PanelContainer';
}
