/**
 * CapsuleShape2D decode — property bag in, radius/height out.
 *
 * Same linked pair as the 3D capsule: `set_radius` RAISES a too-short height to
 * `radius * 2` (`capsule_shape_2d.cpp:67`), `set_height` LOWERS an oversized
 * radius to `height * 0.5` (`:83`), and both reject a negative argument
 * (`ERR_FAIL_COND_MSG`, `:62` / `:78`). Property order is radius (`:134`) then
 * height (`:135`), so with both authored the height stands and radius clamps.
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
    if (height < radius * 2) height = radius * 2;
  }
  if (authoredHeight !== undefined) {
    height = authoredHeight;
    if (radius > height * 0.5) radius = height * 0.5;
  }
  return { radius, height };
}
