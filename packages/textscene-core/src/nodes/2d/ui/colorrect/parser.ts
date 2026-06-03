/** ColorRect parser — Control + a solid fill color. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { ColorRectProperties } from './types';
import { parseControl } from '../control/parser';

export function parseColorRect(
  heading: ParsedHeading,
  properties: Record<string, string>
): ColorRectProperties {
  const result: ColorRectProperties = { ...parseControl(heading, properties) };
  if (properties.color) result.color = properties.color;
  return result;
}
