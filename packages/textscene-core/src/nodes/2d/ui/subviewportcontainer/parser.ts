/**
 * SubViewportContainer parser: Control layout plus the two properties that size and place the
 * displayed target. Defaults from `doc/classes/SubViewportContainer.xml`: `stretch = false`,
 * `stretch_shrink = 1`.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { boolOr, intOr } from '../../../../parser/valueParsers';
import { parseControl } from '../control/parser';
import type { SubViewportContainerProperties } from './types';

export function parseSubViewportContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): SubViewportContainerProperties {
  const base = parseControl(heading, properties);
  const context = `SubViewportContainer ${base.name || '(unnamed)'}`;
  return {
    ...base,
    stretch: boolOr(properties.stretch, false, context),
    stretch_shrink: intOr(properties.stretch_shrink, 1, context),
  };
}
