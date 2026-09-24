/**
 * CapsuleShape3D decode. Either setter rejects a negative (`ERR_FAIL_COND_MSG`,
 * `capsule_shape_3d.cpp:102` / `:116`), keeping the previous value. The loader and
 * the saver both take radius (`:148`), then height (`:149`), so with both authored
 * the height stands and the radius clamps.
 */

import { settableNonNegative } from '../../../parser/valueParsers';
import type { CapsuleShape3DProperties } from './types';

export function decodeCapsuleShape3D(
  properties: Record<string, string>
): CapsuleShape3DProperties {
  const authoredRadius = settableNonNegative(properties.radius, 'CapsuleShape3D radius');
  const authoredHeight = settableNonNegative(properties.height, 'CapsuleShape3D height');

  let radius = 0.5;
  let height = 2;
  if (authoredRadius !== undefined) {
    radius = authoredRadius;
    // `set_radius` raises a too-short height to `radius * 2` (`capsule_shape_3d.cpp:104`).
    if (height < radius * 2) height = radius * 2;
  }
  if (authoredHeight !== undefined) {
    height = authoredHeight;
    // `set_height` lowers an oversized radius to `height * 0.5` (`:118`).
    if (radius > height * 0.5) radius = height * 0.5;
  }
  return { radius, height };
}
