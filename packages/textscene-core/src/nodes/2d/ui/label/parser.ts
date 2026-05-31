/** Label parser — Control + text + alignment. */

import { type ParsedHeading, unquoteString, intOr } from '../../../../parser/utils';
import type { LabelProperties } from './types';
import { parseControl } from '../control/parser';

export function parseLabel(
  heading: ParsedHeading,
  properties: Record<string, string>
): LabelProperties {
  const result: LabelProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.horizontalAlignment = intOr(properties.horizontal_alignment);
  result.verticalAlignment = intOr(properties.vertical_alignment);
  result.autowrapMode = intOr(properties.autowrap_mode);
  return result;
}

export function isLabel(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Label';
}
