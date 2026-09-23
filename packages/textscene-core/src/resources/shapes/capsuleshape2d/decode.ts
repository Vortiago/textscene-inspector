/**
 * CapsuleShape2D decode, the 3D capsule's linked pair. Both setters reject a negative
 * (`ERR_FAIL_COND_MSG`, `capsule_shape_2d.cpp:62` / `:78`), and radius (`:134`) loads
 * before height (`:135`), so with both authored the height stands and radius clamps.
 */

import { settableNonNegative } from '../../../parser/valueParsers';
import type { CapsuleShape2DProperties } from './types';

export function decodeCapsuleShape2D(
  properties: Record<string, string>
): CapsuleShape2DProperties {
  const authoredRadius = settableNonNegative(properties.radius, 'CapsuleShape2D radius');
  const authoredHeight = settableNonNegative(properties.height, 'CapsuleShape2D height');

  let radius = 10;
  let height = 30;
  if (authoredRadius !== undefined) {
    radius = authoredRadius;
    // `set_radius` raises a too-short height to `radius * 2` (`capsule_shape_2d.cpp:67`).
    if (height < radius * 2) height = radius * 2;
  }
  if (authoredHeight !== undefined) {
    height = authoredHeight;
    // `set_height` lowers an oversized radius to `height * 0.5` (`:83`).
    if (radius > height * 0.5) radius = height * 0.5;
  }
  return { radius, height };
}
