/** Parses a TouchScreenButton: the Node2D surface plus `texture_normal` and the collision shape keys. */

import type { ParsedHeading } from '../../../parser/utils';
import { holdsResource } from '../../../godot/scene/resourceLiteral';
import { boolOr } from '../../../parser/valueParsers';
import { parseNode2D } from '../../base/node2d/parser';
import type { TouchScreenButtonProperties } from './types';

export function parseTouchScreenButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): TouchScreenButtonProperties {
  const result: TouchScreenButtonProperties = {
    ...parseNode2D(heading, properties),
    // `shape_centered` and `shape_visible` default to true (touch_screen_button.h:52-53).
    shape_centered: boolOr(properties.shape_centered, true),
    shape_visible: boolOr(properties.shape_visible, true),
  };
  if (holdsResource(properties.texture_normal)) result.texture_normal = properties.texture_normal;
  if (holdsResource(properties.shape)) result.shape = properties.shape;
  return result;
}
