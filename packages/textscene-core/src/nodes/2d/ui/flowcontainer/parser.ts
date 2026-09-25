/**
 * FlowContainer parser: the Control parse plus alignment, last_wrap_alignment,
 * vertical and reverse_fill. HFlowContainer and VFlowContainer share it: they
 * only omit `vertical`, which changes the keys present and not how a key reads.
 */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import type { FlowContainerProperties } from './types';
import { parseControl } from '../control/parser';

export function parseFlowContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): FlowContainerProperties {
  const result: FlowContainerProperties = { ...parseControl(heading, properties) };
  result.alignment = parseOptionalInt(properties.alignment);
  result.lastWrapAlignment = parseOptionalInt(properties.last_wrap_alignment);
  result.vertical = parseOptionalBool(properties.vertical);
  result.reverseFill = parseOptionalBool(properties.reverse_fill);
  return result;
}
