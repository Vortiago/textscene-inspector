/**
 * WorldBoundaryShape2D decode: property bag in, normal and distance out.
 *
 * `set_normal` ERR_FAILs a zero normal (`world_boundary_shape_2d.cpp:64`), refusing the whole
 * assignment, so the default stands. A non-unit normal is kept as authored.
 */

import { isZeroApprox } from '../../../godot/math/math';
import { floatOr, vec2Or } from '../../../parser/valueParsers';
import type { WorldBoundaryShape2DProperties } from './types';

const DEFAULT_NORMAL = { x: 0, y: -1 };

export function decodeWorldBoundaryShape2D(
  properties: Record<string, string>
): WorldBoundaryShape2DProperties {
  const normal = vec2Or(properties.normal, DEFAULT_NORMAL, 'WorldBoundaryShape2D normal');
  return {
    normal: isZeroApprox(normal.x) && isZeroApprox(normal.y) ? DEFAULT_NORMAL : normal,
    distance: floatOr(properties.distance, 0, 'WorldBoundaryShape2D distance'),
  };
}
