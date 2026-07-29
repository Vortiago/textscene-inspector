/**
 * VSplitContainer parser — delegates to the shared SplitContainer base
 * (Control plus `split_offset`, `collapsed`, `dragger_visibility`). The axis
 * is the only thing this slice adds, and it is a Component concern.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseSplitContainer } from '../shared/splitContainer';
import type { VSplitContainerProperties } from './types';

export function parseVSplitContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): VSplitContainerProperties {
  return parseSplitContainer(heading, properties);
}
