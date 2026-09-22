/**
 * SplitContainer parser — the shared SplitContainer base (Control +
 * `split_offset`/`collapsed`/`dragger_visibility`) plus `vertical`, which
 * this base — unlike its fixed-axis HSplitContainer/VSplitContainer
 * subclasses — genuinely serialises (`types.ts`'s own doc).
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool } from '../../../../parser/valueParsers';
import { parseSplitContainer as parseSharedSplitContainer } from '../shared/splitContainer';
import type { SplitContainerProperties } from './types';

export function parseSplitContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): SplitContainerProperties {
  const result: SplitContainerProperties = { ...parseSharedSplitContainer(heading, properties) };
  result.vertical = parseOptionalBool(properties.vertical);
  return result;
}
