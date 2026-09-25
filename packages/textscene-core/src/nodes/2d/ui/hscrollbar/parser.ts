/**
 * HScrollBar parser: delegates to the shared ScrollBar base (Control +
 * Range + `custom_step`). HScrollBar adds no properties of its own; only the
 * draw axis differs, which is the Component's business.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseScrollBar } from '../shared/scrollBar';
import type { HScrollBarProperties } from './types';

export function parseHScrollBar(
  heading: ParsedHeading,
  properties: Record<string, string>
): HScrollBarProperties {
  return parseScrollBar(heading, properties);
}
