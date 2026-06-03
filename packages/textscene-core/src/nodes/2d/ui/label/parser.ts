/** Label parser — Control + text + alignment. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { LabelProperties } from './types';
import { parseControl } from '../control/parser';

export function parseLabel(
  heading: ParsedHeading,
  properties: Record<string, string>
): LabelProperties {
  const result: LabelProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.horizontalAlignment = parseOptionalInt(properties.horizontal_alignment);
  result.verticalAlignment = parseOptionalInt(properties.vertical_alignment);
  result.autowrapMode = parseOptionalInt(properties.autowrap_mode);
  return result;
}
