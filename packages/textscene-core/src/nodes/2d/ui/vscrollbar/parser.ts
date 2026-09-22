/**
 * VScrollBar parser — delegates to the shared ScrollBar base (Control +
 * Range + `custom_step`). VScrollBar adds no properties of its own; only the
 * draw axis differs, which is the Component's business.
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
