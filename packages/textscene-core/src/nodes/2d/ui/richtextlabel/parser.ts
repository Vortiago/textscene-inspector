/** RichTextLabel parser — Control + text + bbcode/fit-content flags. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import type { RichTextLabelProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue } from '../../../../godot/index.js';

export function parseRichTextLabel(
  heading: ParsedHeading,
  properties: Record<string, string>
): RichTextLabelProperties {
  const result: RichTextLabelProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.bbcodeEnabled = boolSlotValue(properties.bbcode_enabled) === true;
  result.fitContent = boolSlotValue(properties.fit_content) === true;
  return result;
}
