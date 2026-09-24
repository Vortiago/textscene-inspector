/** GraphFrame parser: GraphElement + `title`/`autoshrink_*`/`drag_margin`/`tint_color*`. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import type { GraphFrameProperties } from './types';
import { parseGraphElement } from '../graphelement/parser';

export function parseGraphFrame(
  heading: ParsedHeading,
  properties: Record<string, string>
): GraphFrameProperties {
  const result: GraphFrameProperties = { ...parseGraphElement(heading, properties) };

  if (properties.title !== undefined) result.title = unquoteString(properties.title);
  result.autoshrinkEnabled = parseOptionalBool(properties.autoshrink_enabled);
  result.autoshrinkMargin = parseOptionalInt(properties.autoshrink_margin);
  result.dragMargin = parseOptionalInt(properties.drag_margin);
  result.tintColorEnabled = parseOptionalBool(properties.tint_color_enabled);
  result.tintColor = parseColorOrUndefined(properties.tint_color);

  return result;
}
