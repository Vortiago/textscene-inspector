/**
 * BoxContainer parser: the shared base (Control and `alignment`) plus `vertical`,
 * which this class serialises and its fixed-axis subclasses do not.
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
