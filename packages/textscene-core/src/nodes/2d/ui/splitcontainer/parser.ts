/**
 * SplitContainer parser: the shared SplitContainer base plus `vertical`, which this base serialises
 * and its fixed-axis subclasses do not (`types.ts`).
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
