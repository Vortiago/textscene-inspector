/** GridContainer parser — Control + column count. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { GridContainerProperties } from './types';
import { parseControl } from '../control/parser';

function intOr(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

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
