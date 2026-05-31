/** GridContainer parser — Control + column count. */

import { type ParsedHeading, intOr } from '../../../../parser/utils';
import type { GridContainerProperties } from './types';
import { parseControl } from '../control/parser';

export function parseGridContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): GridContainerProperties {
  const result: GridContainerProperties = { ...parseControl(heading, properties) };
  result.columns = intOr(properties.columns);
  return result;
}

export function isGridContainer(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'GridContainer';
}
