/** LinkButton parser — Control + its own text/uri/underline/overrun_behavior, plus BaseButton's disabled/button_pressed (LinkButton derives from BaseButton directly, not Button — link_button.cpp:36). */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { LinkButtonProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue } from '../../../../godot/index.js';

export function parseLinkButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): LinkButtonProperties {
  const result: LinkButtonProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  if (properties.uri !== undefined) result.uri = unquoteString(properties.uri);
  result.underline = parseOptionalInt(properties.underline);
  result.overrunBehavior = parseOptionalInt(properties.text_overrun_behavior);
  result.disabled = boolSlotValue(properties.disabled) === true;
  result.buttonPressed = boolSlotValue(properties.button_pressed) === true;
  return result;
}
