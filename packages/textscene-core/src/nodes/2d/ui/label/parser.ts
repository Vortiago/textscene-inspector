/** Label parser — Control + text + alignment. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { LabelProperties } from './types';
import { parseControl } from '../control/parser';

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

function intOr(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

export function parseLabel(
  heading: ParsedHeading,
  properties: Record<string, string>
): LabelProperties {
  const result: LabelProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquote(properties.text);
  result.horizontalAlignment = intOr(properties.horizontal_alignment);
  result.verticalAlignment = intOr(properties.vertical_alignment);
  result.autowrapMode = intOr(properties.autowrap_mode);
  return result;
}

export function isLabel(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Label';
}
