/**
 * CenterContainer parser: Control plus `use_top_left` (`center_container.h:38`).
 * Centring is the solver's concern.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool } from '../../../../parser/valueParsers';
import type { CenterContainerProperties } from './types';
import { parseControl } from '../control/parser';

export function parseCenterContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): CenterContainerProperties {
  const result: CenterContainerProperties = { ...parseControl(heading, properties) };
  result.useTopLeft = parseOptionalBool(properties.use_top_left);
  return result;
}
