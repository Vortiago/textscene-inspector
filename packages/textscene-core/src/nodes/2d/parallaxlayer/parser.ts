/**
 * ParallaxLayer parser — the Node2D surface plus the `motion_*` group.
 *
 * `motion_mirroring` is clamped at 0 per axis, matching
 * `ParallaxLayer::set_mirroring`'s `p_mirroring.maxf(0)`: a negative interval
 * would make the repeat wrap the wrong way, so Godot never stores one.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { vec2Or } from '../../../parser/valueParsers';
import { parseNode2D } from '../../base/node2d/parser';
import type { ParallaxLayerProperties } from './types';

export function parseParallaxLayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): ParallaxLayerProperties {
  const base = parseNode2D(heading, properties);
  const context = base.name || 'ParallaxLayer';
  const mirroring = vec2Or(properties.motion_mirroring, { x: 0, y: 0 }, context);
  return {
    ...base,
    motion_scale: vec2Or(properties.motion_scale, { x: 1, y: 1 }, context),
    motion_offset: vec2Or(properties.motion_offset, { x: 0, y: 0 }, context),
    motion_mirroring: { x: Math.max(0, mirroring.x), y: Math.max(0, mirroring.y) },
  };
}
