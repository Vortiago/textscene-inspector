/**
 * BoxContainer parser — the shared BoxContainer base (Control + `alignment`)
 * plus `vertical`, which this base — unlike its fixed-axis HBoxContainer/
 * VBoxContainer subclasses — genuinely serialises (`types.ts`'s own doc).
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool } from '../../../../parser/valueParsers';
import { parseBoxContainer as parseSharedBoxContainer } from '../shared/boxContainer';
import type { BoxContainerProperties } from './types';

export function parseBoxContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): BoxContainerProperties {
  const result: BoxContainerProperties = { ...parseSharedBoxContainer(heading, properties) };
  result.vertical = parseOptionalBool(properties.vertical);
  return result;
}
