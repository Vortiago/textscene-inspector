/** RichTextLabel parser — Control + text + bbcode/fit-content flags. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { RichTextLabelProperties } from './types';
import { parseControl } from '../control/parser';

export function parseRichTextLabel(
  heading: ParsedHeading,
  properties: Record<string, string>
): RichTextLabelProperties {
  const result: RichTextLabelProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.bbcodeEnabled = properties.bbcode_enabled === 'true';
  result.fitContent = properties.fit_content === 'true';
  result.autowrapMode = parseOptionalInt(properties.autowrap_mode);
  return result;
}
