/**
 * FlowContainer parser — Control plus alignment/last_wrap_alignment/vertical/
 * reverse_fill. Shared by HFlowContainer/VFlowContainer (`../hflowcontainer`,
 * `../vflowcontainer` import this directly rather than duplicating it) — the
 * one difference, that the fixed subclasses never serialise `vertical`, is a
 * matter of which keys are PRESENT in `properties`, not of how any key is
 * read, so one parser covers all three.
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
