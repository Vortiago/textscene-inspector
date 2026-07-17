/**
 * VBoxContainer parser. Control base plus BoxContainer's `alignment`
 * (main-axis packing); the vertical stacking itself and
 * `theme_override_constants/separation` are handled by the Component +
 * the base Control parser's theme-override collection.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { VBoxContainerProperties } from './types';
import { parseControl } from '../control/parser';

export function parseVBoxContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): VBoxContainerProperties {
  const result: VBoxContainerProperties = { ...parseControl(heading, properties) };
  result.alignment = parseOptionalInt(properties.alignment);
  return result;
}
