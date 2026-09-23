/**
 * ScrollContainer parser: Control layout, the per-axis scroll modes (`horizontal_scroll_mode`/
 * `vertical_scroll_mode`), the authored scroll offsets, `draw_focus_border` and `scroll_hint_mode`.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseControl } from '../control/parser';
import type { ScrollContainerProperties } from './types';

export function parseScrollContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): ScrollContainerProperties {
  const result: ScrollContainerProperties = { ...parseControl(heading, properties) };
  result.horizontalScrollMode = parseOptionalInt(properties.horizontal_scroll_mode);
  result.verticalScrollMode = parseOptionalInt(properties.vertical_scroll_mode);
  result.scrollHorizontal = parseOptionalInt(properties.scroll_horizontal);
  result.scrollVertical = parseOptionalInt(properties.scroll_vertical);
  result.drawFocusBorder = parseOptionalBool(properties.draw_focus_border);
  result.scrollHintMode = parseOptionalInt(properties.scroll_hint_mode);
  return result;
}
