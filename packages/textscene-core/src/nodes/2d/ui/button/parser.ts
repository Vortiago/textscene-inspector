/** Button parser — Control + text + disabled/flat flags + alignment. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { ButtonProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue } from '../../../../godot/index.js';

export function parseButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): ButtonProperties {
  const result: ButtonProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.disabled = boolSlotValue(properties.disabled) === true;
  result.flat = boolSlotValue(properties.flat) === true;
  result.alignment = parseOptionalInt(properties.alignment);
  // class_button.html: icon_alignment 0 (LEFT), vertical_icon_alignment 1
  // (CENTER), expand_icon false. An icon-only button carries no text.
  if (properties.icon !== undefined) result.icon = properties.icon;
  result.iconAlignment = parseOptionalInt(properties.icon_alignment);
  result.verticalIconAlignment = parseOptionalInt(properties.vertical_icon_alignment);
  result.expandIcon = boolSlotValue(properties.expand_icon) === true;
  result.overrunBehavior = parseOptionalInt(properties.text_overrun_behavior);
  if (boolSlotValue(properties.clip_text) === true) result.clipText = true;
  return result;
}
