/** Button parser — Control + text + disabled/flat flags + alignment. */

import { type ParsedHeading, unquoteString, intOr } from '../../../../parser/utils';
import type { ButtonProperties } from './types';
import { parseControl } from '../control/parser';

export function parseButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): ButtonProperties {
  const result: ButtonProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.disabled = properties.disabled === 'true';
  result.flat = properties.flat === 'true';
  result.alignment = intOr(properties.alignment);
  return result;
}

export function isButton(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Button';
}
