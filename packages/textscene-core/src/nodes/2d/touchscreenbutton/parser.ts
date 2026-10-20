/** Parses a TouchScreenButton: the Node2D surface plus `texture_normal`. */

import type { ParsedHeading } from '../../../parser/utils';
import { holdsResource } from '../../../godot/scene/resourceLiteral';
import { parseNode2D } from '../../base/node2d/parser';
import type { TouchScreenButtonProperties } from './types';

export function parseTouchScreenButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): TouchScreenButtonProperties {
  const result: TouchScreenButtonProperties = parseNode2D(heading, properties);
  if (holdsResource(properties.texture_normal)) result.texture_normal = properties.texture_normal;
  return result;
}
