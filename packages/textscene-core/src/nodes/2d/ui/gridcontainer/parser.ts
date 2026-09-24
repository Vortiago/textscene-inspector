/** GridContainer parser: Control + column count. */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { GridContainerProperties } from './types';
import { parseControl } from '../control/parser';

export function parseGridContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): GridContainerProperties {
  const result: GridContainerProperties = { ...parseControl(heading, properties) };
  result.columns = parseOptionalInt(properties.columns);
  return result;
}
