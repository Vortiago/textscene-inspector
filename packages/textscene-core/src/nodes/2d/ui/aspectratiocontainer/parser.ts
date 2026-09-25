/** AspectRatioContainer parser: Control plus ratio, stretch_mode and alignment. */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalFloat, parseOptionalInt } from '../../../../parser/valueParsers';
import type { AspectRatioContainerProperties } from './types';
import { parseControl } from '../control/parser';

export function parseAspectRatioContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): AspectRatioContainerProperties {
  const result: AspectRatioContainerProperties = { ...parseControl(heading, properties) };
  result.ratio = parseOptionalFloat(properties.ratio);
  result.stretchMode = parseOptionalInt(properties.stretch_mode);
  result.alignmentHorizontal = parseOptionalInt(properties.alignment_horizontal);
  result.alignmentVertical = parseOptionalInt(properties.alignment_vertical);
  return result;
}
