/** The render parse of a VisibleOnScreenNotifier3D, and of its subclass the Enabler: the Node3D parse and `aabb`. */

import { VISIBLE_ON_SCREEN_NOTIFIER_3D_DEFAULT_AABB } from '../../../godot/scene/visibleOnScreen';
import type { ParsedHeading } from '../../../parser/utils';
import { parseOptionalAabb } from '../../../parser/valueParsers';
import { parseNode3D } from '../../base/node3d/parser';
import type { VisibleOnScreenNotifier3DProperties } from './types';

export function parseVisibleOnScreenNotifier3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): VisibleOnScreenNotifier3DProperties {
  return {
    ...parseNode3D(heading, properties),
    aabb: parseOptionalAabb(properties.aabb, 'aabb') ?? VISIBLE_ON_SCREEN_NOTIFIER_3D_DEFAULT_AABB,
  };
}
