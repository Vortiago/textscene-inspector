/**
 * ScrollContainer parser. Adds no fields beyond Control — its scrolling
 * behaviour (overflow) is handled entirely by the Component.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

export function parseScrollContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): ControlProperties {
  return parseControl(heading, properties);
}

export function isScrollContainer(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'ScrollContainer';
}
