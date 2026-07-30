/**
 * HSplitContainer parser — delegates to the shared SplitContainer base
 * (Control plus `split_offset`, `collapsed`, `dragger_visibility`). The axis
 * is the only thing this slice adds, and it is a Component concern.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseSplitContainer } from '../shared/splitContainer';
import type { HSplitContainerProperties } from './types';

export function parseHSplitContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): HSplitContainerProperties {
  return parseSplitContainer(heading, properties);
}
