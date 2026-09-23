/**
 * Parses a VScrollBar through the shared ScrollBar base (Control, Range and `custom_step`).
 * VScrollBar adds no properties. Only the draw axis differs, and the Component handles it.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseScrollBar } from '../shared/scrollBar';
import type { VScrollBarProperties } from './types';

export function parseVScrollBar(
  heading: ParsedHeading,
  properties: Record<string, string>
): VScrollBarProperties {
  return parseScrollBar(heading, properties);
}
