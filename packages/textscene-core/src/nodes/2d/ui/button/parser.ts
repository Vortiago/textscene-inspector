/** Button parser — Control + text + disabled/flat flags + alignment. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ButtonProperties } from './types';
import { parseControl } from '../control/parser';

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

function intOr(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

export function parseButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): ButtonProperties {
  const result: ButtonProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquote(properties.text);
  result.disabled = properties.disabled === 'true';
  result.flat = properties.flat === 'true';
  result.alignment = intOr(properties.alignment);
  return result;
}

export function isButton(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Button';
}
