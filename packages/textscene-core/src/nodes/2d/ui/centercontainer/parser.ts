/**
 * CenterContainer parser. Adds one field beyond Control — `use_top_left`
 * (`center_container.h:38`) — everything else about centering its child(ren)
 * is a layout concern handled by the solver/Component, so the base Control
 * parser does the rest of the work.
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
